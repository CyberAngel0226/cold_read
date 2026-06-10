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

export type ExternalRiskFlag =
  | "MAJOR_COUNTEREVIDENCE"
  | "REVERSAL_RISK"
  | "LATE_BREAKING_EVENT"
  | "RESOLUTION_DISPUTE_RISK"
  | "UNCLEAR_CONTEXT";

export type ExternalRiskRecommendationDraft = {
  action: RecommendationAction;
  targetMarketId?: string;
  rationale: string;
  confidence: ConfidenceLevel;
  riskLevel: RiskLevel;
  evidenceRefs: readonly string[];
  externalRiskFlags: readonly ExternalRiskFlag[];
};

export type GenerateExternalRiskDraftWithPythonInput = {
  evidenceSnapshot: EvidenceSnapshot;
  pythonExecutable?: string;
  scriptPath?: string;
};

export type AdaptExternalRiskDraftInput = {
  evidenceSnapshot: EvidenceSnapshot;
  draft: ExternalRiskRecommendationDraft;
  now: IsoTimestamp;
  createRecommendationId: () => string;
  createWalletActionProposalId: () => string;
  smallStakeAmount: string;
};

export type GenerateExternalRiskRecommendationWithPythonInput =
  GenerateExternalRiskDraftWithPythonInput &
    Omit<AdaptExternalRiskDraftInput, "draft">;

export async function generateExternalRiskDraftWithPython(
  input: GenerateExternalRiskDraftWithPythonInput,
): Promise<ExternalRiskRecommendationDraft> {
  const stdout = await runPythonExternalRiskLens(input);
  return parseExternalRiskDraft(stdout);
}

export async function generateExternalRiskRecommendationWithPython(
  input: GenerateExternalRiskRecommendationWithPythonInput,
): Promise<AgentRecommendation> {
  const draft = await generateExternalRiskDraftWithPython(input);

  return adaptExternalRiskDraft({
    evidenceSnapshot: input.evidenceSnapshot,
    draft,
    now: input.now,
    createRecommendationId: input.createRecommendationId,
    createWalletActionProposalId: input.createWalletActionProposalId,
    smallStakeAmount: input.smallStakeAmount,
  });
}

export function adaptExternalRiskDraft(
  input: AdaptExternalRiskDraftInput,
): AgentRecommendation {
  validateAction(input.draft.action);
  validateEvidenceRefs(input);

  if (input.draft.action === "HOLD" || hasMaterialExternalRisk(input.draft)) {
    if (input.draft.action === "HOLD" && input.draft.targetMarketId !== undefined) {
      throw new Error("HOLD recommendations cannot target a market.");
    }

    return {
      id: input.createRecommendationId(),
      decisionRunId: input.evidenceSnapshot.decisionRunId,
      evidenceSnapshotId: input.evidenceSnapshot.id,
      analysisLens: "EXTERNAL_RISK",
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
    analysisLens: "EXTERNAL_RISK",
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

async function runPythonExternalRiskLens(
  input: GenerateExternalRiskDraftWithPythonInput,
): Promise<string> {
  const pythonExecutable =
    input.pythonExecutable ?? process.env.PYTHON ?? "python";
  const scriptPath =
    input.scriptPath ?? join(process.cwd(), "agents", "external_risk_lens.py");

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
            `Python External Risk Lens failed with exit code ${code}: ${Buffer.concat(stderr).toString("utf8").trim()}`,
          ),
        );
        return;
      }

      resolve(Buffer.concat(stdout).toString("utf8"));
    });

    child.stdin.end(JSON.stringify(input.evidenceSnapshot));
  });
}

function parseExternalRiskDraft(stdout: string): ExternalRiskRecommendationDraft {
  const parsed: unknown = JSON.parse(stdout);
  if (!isExternalRiskRecommendationDraft(parsed)) {
    throw new Error("Python External Risk Lens returned a malformed draft.");
  }

  return parsed;
}

function hasMaterialExternalRisk(draft: ExternalRiskRecommendationDraft): boolean {
  return draft.externalRiskFlags.some((flag) =>
    flag === "MAJOR_COUNTEREVIDENCE"
    || flag === "REVERSAL_RISK"
    || flag === "LATE_BREAKING_EVENT"
    || flag === "RESOLUTION_DISPUTE_RISK"
    || flag === "UNCLEAR_CONTEXT"
  );
}

function isExternalRiskRecommendationDraft(
  value: unknown,
): value is ExternalRiskRecommendationDraft {
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
    draft.evidenceRefs.every((evidenceRef) => typeof evidenceRef === "string") &&
    Array.isArray(draft.externalRiskFlags) &&
    draft.externalRiskFlags.every(isExternalRiskFlag)
  );
}

function validateAction(action: RecommendationAction): void {
  if (
    action !== "BUY_YES_SMALL"
    && action !== "BUY_NO_SMALL"
    && action !== "HOLD"
  ) {
    throw new Error("Unsupported External Risk action.");
  }
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

function isExternalRiskFlag(value: unknown): value is ExternalRiskFlag {
  return (
    value === "MAJOR_COUNTEREVIDENCE"
    || value === "REVERSAL_RISK"
    || value === "LATE_BREAKING_EVENT"
    || value === "RESOLUTION_DISPUTE_RISK"
    || value === "UNCLEAR_CONTEXT"
  );
}
function validateEvidenceRefs(input: AdaptExternalRiskDraftInput): void {
  const contextEvidenceIds = new Set(
    input.evidenceSnapshot.contextEvidence.items.map((item) => item.id),
  );
  if (
    input.draft.evidenceRefs.some(
      (evidenceRef) => !contextEvidenceIds.has(evidenceRef),
    )
  ) {
    throw new Error("External Risk evidenceRefs must reference snapshot context evidence.");
  }
}

function snapshotMarketIds(evidenceSnapshot: EvidenceSnapshot): Set<string> {
  return new Set(
    evidenceSnapshot.marketEvidence.screenedMarkets.map((market) => market.id),
  );
}
