import { spawn } from "node:child_process";
import { join } from "node:path";

import type {
  AgentRecommendation,
  ConfidenceLevel,
  EvidenceSnapshot,
  IsoTimestamp,
  RecommendationAction,
  RiskLevel,
} from "./domain.js";

export type MarketStructureRecommendationDraft = {
  action: RecommendationAction;
  targetMarketId?: string;
  rationale: string;
  confidence: ConfidenceLevel;
  riskLevel: RiskLevel;
  evidenceRefs: readonly string[];
};

export type GenerateMarketStructureDraftWithPythonInput = {
  evidenceSnapshot: EvidenceSnapshot;
  pythonExecutable?: string;
  scriptPath?: string;
};

export type AdaptMarketStructureDraftInput = {
  evidenceSnapshot: EvidenceSnapshot;
  draft: MarketStructureRecommendationDraft;
  now: IsoTimestamp;
  createRecommendationId: () => string;
  createWalletActionProposalId: () => string;
  smallStakeAmount: string;
};

export type GenerateMarketStructureRecommendationWithPythonInput =
  GenerateMarketStructureDraftWithPythonInput &
    Omit<AdaptMarketStructureDraftInput, "draft">;

export async function generateMarketStructureDraftWithPython(
  input: GenerateMarketStructureDraftWithPythonInput,
): Promise<MarketStructureRecommendationDraft> {
  const stdout = await runPythonMarketStructureLens(input);
  return parseMarketStructureDraft(stdout);
}

export async function generateMarketStructureRecommendationWithPython(
  input: GenerateMarketStructureRecommendationWithPythonInput,
): Promise<AgentRecommendation> {
  const draft = await generateMarketStructureDraftWithPython(input);

  return adaptMarketStructureDraft({
    evidenceSnapshot: input.evidenceSnapshot,
    draft,
    now: input.now,
    createRecommendationId: input.createRecommendationId,
    createWalletActionProposalId: input.createWalletActionProposalId,
    smallStakeAmount: input.smallStakeAmount,
  });
}

export function adaptMarketStructureDraft(
  input: AdaptMarketStructureDraftInput,
): AgentRecommendation {
  validateAction(input.draft.action);
  validateEvidenceRefs(input);

  if (input.draft.action === "HOLD") {
    if (input.draft.targetMarketId !== undefined) {
      throw new Error("HOLD recommendations cannot target a market.");
    }

    return {
      id: input.createRecommendationId(),
      decisionRunId: input.evidenceSnapshot.decisionRunId,
      evidenceSnapshotId: input.evidenceSnapshot.id,
      analysisLens: "MARKET_STRUCTURE",
      action: "HOLD",
      rationale: input.draft.rationale,
      confidence: input.draft.confidence,
      riskLevel: input.draft.riskLevel,
      evidenceRefs: input.draft.evidenceRefs,
      createdAt: input.now,
    };
  }

  if (input.draft.targetMarketId === undefined) {
    throw new Error("Buy recommendations require a target market.");
  }

  if (!snapshotMarketIds(input.evidenceSnapshot).has(input.draft.targetMarketId)) {
    throw new Error("Buy recommendations must target a snapshot market.");
  }

  const targetMarketId = input.draft.targetMarketId;

  return {
    id: input.createRecommendationId(),
    decisionRunId: input.evidenceSnapshot.decisionRunId,
    evidenceSnapshotId: input.evidenceSnapshot.id,
    analysisLens: "MARKET_STRUCTURE",
    action: input.draft.action,
    targetMarketId,
    walletActionProposal: {
      id: input.createWalletActionProposalId(),
      marketId: targetMarketId,
      action: input.draft.action,
      stake: {
        amount: input.smallStakeAmount,
        currency: "USDC",
      },
      rationale: input.draft.rationale,
    },
    rationale: input.draft.rationale,
    confidence: input.draft.confidence,
    riskLevel: input.draft.riskLevel,
    evidenceRefs: input.draft.evidenceRefs,
    createdAt: input.now,
  };
}

async function runPythonMarketStructureLens(
  input: GenerateMarketStructureDraftWithPythonInput,
): Promise<string> {
  const pythonExecutable = input.pythonExecutable ?? "python3";
  const scriptPath =
    input.scriptPath ?? join(process.cwd(), "agents", "market_structure_lens.py");

  return await new Promise((resolve, reject) => {
    const child = spawn(pythonExecutable, [scriptPath, "--snapshot-file", "-"], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];

    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(
          new Error(
            `Python Market Structure Lens failed with exit code ${code}: ${Buffer.concat(stderr).toString("utf8").trim()}`,
          ),
        );
        return;
      }

      resolve(Buffer.concat(stdout).toString("utf8"));
    });

    child.stdin.end(JSON.stringify(input.evidenceSnapshot));
  });
}

function parseMarketStructureDraft(
  stdout: string,
): MarketStructureRecommendationDraft {
  const parsed: unknown = JSON.parse(stdout);
  if (!isMarketStructureRecommendationDraft(parsed)) {
    throw new Error("Python Market Structure Lens returned a malformed draft.");
  }

  return parsed;
}

function isMarketStructureRecommendationDraft(
  value: unknown,
): value is MarketStructureRecommendationDraft {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const draft = value as Record<string, unknown>;
  return (
    isRecommendationAction(draft.action) &&
    (draft.targetMarketId === undefined ||
      typeof draft.targetMarketId === "string") &&
    typeof draft.rationale === "string" &&
    isConfidenceLevel(draft.confidence) &&
    isRiskLevel(draft.riskLevel) &&
    Array.isArray(draft.evidenceRefs) &&
    draft.evidenceRefs.every((evidenceRef) => typeof evidenceRef === "string")
  );
}

function validateAction(action: RecommendationAction): void {
  if (
    action !== "BUY_YES_SMALL"
    && action !== "BUY_NO_SMALL"
    && action !== "HOLD"
  ) {
    throw new Error("Unsupported Market Structure action.");
  }
}

function validateEvidenceRefs(input: AdaptMarketStructureDraftInput): void {
  const marketIds = snapshotMarketIds(input.evidenceSnapshot);
  if (input.draft.evidenceRefs.some((evidenceRef) => !marketIds.has(evidenceRef))) {
    throw new Error("Market Structure evidenceRefs must reference snapshot market evidence.");
  }
}

function snapshotMarketIds(evidenceSnapshot: EvidenceSnapshot): Set<string> {
  return new Set(
    evidenceSnapshot.marketEvidence.screenedMarkets.map((market) => market.id),
  );
}

function isRecommendationAction(value: unknown): value is RecommendationAction {
  return (
    value === "BUY_YES_SMALL" || value === "BUY_NO_SMALL" || value === "HOLD"
  );
}

function isConfidenceLevel(value: unknown): value is ConfidenceLevel {
  return value === "LOW" || value === "MEDIUM" || value === "HIGH";
}

function isRiskLevel(value: unknown): value is RiskLevel {
  return value === "LOW" || value === "MEDIUM" || value === "HIGH";
}
