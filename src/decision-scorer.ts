import type {
  AgentRecommendation,
  EvidenceSnapshot,
  FinalDecision,
  IsoTimestamp,
  VetoCondition,
  WalletActionProposal,
} from "./domain.js";

export type SelectFinalDecisionInput = {
  evidenceSnapshot: EvidenceSnapshot;
  agentRecommendations: readonly AgentRecommendation[];
  vetoConditions?: readonly VetoCondition[];
  now: IsoTimestamp;
  createFinalDecisionId: () => string;
};

export type DecisionScoringDraft = {
  selectedRecommendationId?: string;
  rationale: string;
  vetoConditions: readonly VetoCondition[];
  walletActionProposal?: never;
};

export type AdaptDecisionScoringDraftInput = {
  evidenceSnapshot: EvidenceSnapshot;
  agentRecommendations: readonly AgentRecommendation[];
  draft: DecisionScoringDraft;
  now: IsoTimestamp;
  createFinalDecisionId: () => string;
};

type DecisionScoringDraftShape = DecisionScoringDraft & {
  walletActionProposal?: WalletActionProposal;
};

export function selectFinalDecision(
  input: SelectFinalDecisionInput,
): FinalDecision {
  if (input.vetoConditions !== undefined && input.vetoConditions.length > 0) {
    return {
      id: input.createFinalDecisionId(),
      decisionRunId: input.evidenceSnapshot.decisionRunId,
      action: "HOLD",
      rationale:
        `Downgraded to HOLD because veto conditions appeared: ${input.vetoConditions.join(", ")}.`,
      vetoConditions: input.vetoConditions,
      createdAt: input.now,
    };
  }

  const selectedRecommendation = selectRecommendation(input.agentRecommendations);

  if (selectedRecommendation.action === "HOLD") {
    return {
      id: input.createFinalDecisionId(),
      decisionRunId: input.evidenceSnapshot.decisionRunId,
      selectedRecommendationId: selectedRecommendation.id,
      action: "HOLD",
      rationale:
        `Selected ${selectedRecommendation.id} because it has the strongest non-vetoed recommendation profile.`,
      vetoConditions: [],
      createdAt: input.now,
    };
  }

  return {
    id: input.createFinalDecisionId(),
    decisionRunId: input.evidenceSnapshot.decisionRunId,
    selectedRecommendationId: selectedRecommendation.id,
    action: selectedRecommendation.action,
    rationale:
      `Selected ${selectedRecommendation.id} because it has the strongest non-vetoed recommendation profile.`,
    vetoConditions: [],
    walletActionProposal: selectedRecommendation.walletActionProposal,
    createdAt: input.now,
  };
}

export function adaptDecisionScoringDraft(
  input: AdaptDecisionScoringDraftInput,
): FinalDecision {
  const draft = input.draft as DecisionScoringDraftShape;
  if (draft.walletActionProposal !== undefined) {
    throw new Error("Decision Scorer drafts cannot create wallet actions.");
  }

  if (draft.vetoConditions.length > 0) {
    return {
      id: input.createFinalDecisionId(),
      decisionRunId: input.evidenceSnapshot.decisionRunId,
      action: "HOLD",
      rationale: draft.rationale,
      vetoConditions: draft.vetoConditions,
      createdAt: input.now,
    };
  }

  if (draft.selectedRecommendationId === undefined) {
    throw new Error("Decision Scorer drafts must select a recommendation or provide a veto.");
  }

  const selectedRecommendation = input.agentRecommendations.find(
    (recommendation) => recommendation.id === draft.selectedRecommendationId,
  );
  if (selectedRecommendation === undefined) {
    throw new Error("Decision Scorer drafts must select an existing recommendation.");
  }

  if (selectedRecommendation.action === "HOLD") {
    return {
      id: input.createFinalDecisionId(),
      decisionRunId: input.evidenceSnapshot.decisionRunId,
      selectedRecommendationId: selectedRecommendation.id,
      action: "HOLD",
      rationale: draft.rationale,
      vetoConditions: [],
      createdAt: input.now,
    };
  }

  return {
    id: input.createFinalDecisionId(),
    decisionRunId: input.evidenceSnapshot.decisionRunId,
    selectedRecommendationId: selectedRecommendation.id,
    action: selectedRecommendation.action,
    rationale: draft.rationale,
    vetoConditions: [],
    walletActionProposal: selectedRecommendation.walletActionProposal,
    createdAt: input.now,
  };
}

function selectRecommendation(
  recommendations: readonly AgentRecommendation[],
): AgentRecommendation {
  if (recommendations.length === 0) {
    throw new Error("Final Decision requires at least one Agent Recommendation.");
  }

  return recommendations.reduce((selected, recommendation) => {
    if (recommendationScore(recommendation) > recommendationScore(selected)) {
      return recommendation;
    }
    return selected;
  });
}

function recommendationScore(recommendation: AgentRecommendation): number {
  return (
    actionScore(recommendation)
    + confidenceScore(recommendation.confidence)
    - riskPenalty(recommendation.riskLevel)
  );
}

function actionScore(recommendation: AgentRecommendation): number {
  return recommendation.action === "HOLD" ? 0 : 10;
}

function confidenceScore(confidence: AgentRecommendation["confidence"]): number {
  if (confidence === "HIGH") {
    return 3;
  }
  if (confidence === "MEDIUM") {
    return 2;
  }
  return 1;
}

function riskPenalty(riskLevel: AgentRecommendation["riskLevel"]): number {
  if (riskLevel === "HIGH") {
    return 3;
  }
  if (riskLevel === "MEDIUM") {
    return 1;
  }
  return 0;
}
