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

export type AdaptExternalRiskDraftInput = {
  evidenceSnapshot: EvidenceSnapshot;
  draft: ExternalRiskRecommendationDraft;
  now: IsoTimestamp;
  createRecommendationId: () => string;
  createWalletActionProposalId: () => string;
  smallStakeAmount: string;
};

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

function hasMaterialExternalRisk(draft: ExternalRiskRecommendationDraft): boolean {
  return draft.externalRiskFlags.some((flag) =>
    flag === "MAJOR_COUNTEREVIDENCE"
    || flag === "REVERSAL_RISK"
    || flag === "LATE_BREAKING_EVENT"
    || flag === "RESOLUTION_DISPUTE_RISK"
    || flag === "UNCLEAR_CONTEXT"
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
