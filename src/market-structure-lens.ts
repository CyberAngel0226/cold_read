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

export type AdaptMarketStructureDraftInput = {
  evidenceSnapshot: EvidenceSnapshot;
  draft: MarketStructureRecommendationDraft;
  now: IsoTimestamp;
  createRecommendationId: () => string;
  createWalletActionProposalId: () => string;
  smallStakeAmount: string;
};

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
