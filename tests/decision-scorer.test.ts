import assert from "node:assert/strict";
import test from "node:test";

import {
  adaptDecisionScoringDraft,
  selectFinalDecision,
  type AgentRecommendation,
  type EvidenceSnapshot,
  type DecisionScoringDraft,
  type VetoCondition,
} from "../src/index.js";

const evidenceSnapshot: EvidenceSnapshot = {
  id: "snapshot_1",
  decisionRunId: "run_1",
  createdAt: "2026-06-10T00:04:00.000Z",
  marketEvidence: {
    screenedMarkets: [
      {
        id: "screened_candidate_poly_1",
        sourceCandidateMarketId: "candidate_poly_1",
        polymarketId: "poly_1",
        question: "Will the Fed cut rates in July?",
        outcomes: ["YES", "NO"],
        prices: {
          yes: 0.92,
          no: 0.08,
        },
        volume: 100000,
        liquidity: 25000,
        closeTime: "2026-07-10T00:00:00.000Z",
        resolutionRules: "Resolves YES if the Fed cuts rates in July.",
        oneSidedSignal: {
          side: "YES",
          price: 0.92,
          rationale: "YES price is strongly one-sided.",
        },
        confirmationRationale: "Tavily context found no major counterevidence.",
      },
    ],
  },
  contextEvidence: {
    items: [
      {
        id: "context_1",
        marketId: "candidate_poly_1",
        sourceUrl: "https://example.com/fed-context",
        title: "Fed rate context",
        summary: "No major contrary evidence found.",
        retrievedAt: "2026-06-10T00:03:00.000Z",
      },
    ],
  },
};

const marketStructureRecommendation: AgentRecommendation = {
  id: "rec_market_structure_1",
  decisionRunId: "run_1",
  evidenceSnapshotId: "snapshot_1",
  analysisLens: "MARKET_STRUCTURE",
  action: "BUY_YES_SMALL",
  targetMarketId: "screened_candidate_poly_1",
  walletActionProposal: {
    id: "wallet_action_market_structure_1",
    marketId: "screened_candidate_poly_1",
    action: "BUY_YES_SMALL",
    stake: {
      amount: "5.00",
      currency: "USDC",
    },
    rationale: "Market structure supports a small YES position.",
  },
  rationale: "Market structure supports a small YES position.",
  confidence: "MEDIUM",
  riskLevel: "LOW",
  evidenceRefs: ["screened_candidate_poly_1"],
  createdAt: "2026-06-10T00:05:00.000Z",
};

const externalRiskRecommendation: AgentRecommendation = {
  id: "rec_external_risk_1",
  decisionRunId: "run_1",
  evidenceSnapshotId: "snapshot_1",
  analysisLens: "EXTERNAL_RISK",
  action: "BUY_YES_SMALL",
  targetMarketId: "screened_candidate_poly_1",
  walletActionProposal: {
    id: "wallet_action_external_risk_1",
    marketId: "screened_candidate_poly_1",
    action: "BUY_YES_SMALL",
    stake: {
      amount: "5.00",
      currency: "USDC",
    },
    rationale: "External context does not undermine the YES signal.",
  },
  rationale: "External context does not undermine the YES signal.",
  confidence: "HIGH",
  riskLevel: "LOW",
  evidenceRefs: ["context_1"],
  createdAt: "2026-06-10T00:05:00.000Z",
};

test("selects one existing Agent Recommendation as the Final Decision", () => {
  const finalDecision = selectFinalDecision({
    evidenceSnapshot,
    agentRecommendations: [
      marketStructureRecommendation,
      externalRiskRecommendation,
    ],
    now: "2026-06-10T00:06:00.000Z",
    createFinalDecisionId: () => "decision_1",
  });

  assert.deepEqual(finalDecision, {
    id: "decision_1",
    decisionRunId: "run_1",
    selectedRecommendationId: "rec_external_risk_1",
    action: "BUY_YES_SMALL",
    rationale:
      "Selected rec_external_risk_1 because it has the strongest non-vetoed recommendation profile.",
    vetoConditions: [],
    walletActionProposal: externalRiskRecommendation.walletActionProposal,
    createdAt: "2026-06-10T00:06:00.000Z",
  });
});

const vetoConditions: readonly VetoCondition[] = [
  "UNCLEAR_RESOLUTION_RULES",
  "INSUFFICIENT_LIQUIDITY",
  "TOO_NEAR_RESOLUTION",
  "MAJOR_EXTERNAL_COUNTEREVIDENCE",
  "INCOMPLETE_EVIDENCE_SNAPSHOT",
  "MISSING_EVIDENCE_CITATIONS",
  "WEAK_AGENT_CONVERGENCE",
];

test("downgrades to HOLD when any Veto Condition appears", () => {
  for (const vetoCondition of vetoConditions) {
    const finalDecision = selectFinalDecision({
      evidenceSnapshot,
      agentRecommendations: [
        marketStructureRecommendation,
        externalRiskRecommendation,
      ],
      vetoConditions: [vetoCondition],
      now: "2026-06-10T00:06:00.000Z",
      createFinalDecisionId: () => `decision_${vetoCondition}`,
    });

    assert.deepEqual(finalDecision, {
      id: `decision_${vetoCondition}`,
      decisionRunId: "run_1",
      action: "HOLD",
      rationale: `Downgraded to HOLD because veto conditions appeared: ${vetoCondition}.`,
      vetoConditions: [vetoCondition],
      createdAt: "2026-06-10T00:06:00.000Z",
    });
  }
});

test("adapts a Python scoring draft by selecting an existing Agent Recommendation", () => {
  const draft: DecisionScoringDraft = {
    selectedRecommendationId: "rec_market_structure_1",
    rationale: "Python ranked market structure first.",
    vetoConditions: [],
  };

  const finalDecision = adaptDecisionScoringDraft({
    evidenceSnapshot,
    agentRecommendations: [
      marketStructureRecommendation,
      externalRiskRecommendation,
    ],
    draft,
    now: "2026-06-10T00:06:00.000Z",
    createFinalDecisionId: () => "decision_from_draft_1",
  });

  assert.deepEqual(finalDecision, {
    id: "decision_from_draft_1",
    decisionRunId: "run_1",
    selectedRecommendationId: "rec_market_structure_1",
    action: "BUY_YES_SMALL",
    rationale: "Python ranked market structure first.",
    vetoConditions: [],
    walletActionProposal: marketStructureRecommendation.walletActionProposal,
    createdAt: "2026-06-10T00:06:00.000Z",
  });
});

test("rejects malformed Python scoring drafts that try to create new wallet actions", () => {
  assert.throws(
    () =>
      adaptDecisionScoringDraft({
        evidenceSnapshot,
        agentRecommendations: [
          marketStructureRecommendation,
          externalRiskRecommendation,
        ],
        draft: {
          selectedRecommendationId: "rec_market_structure_1",
          rationale: "Python tried to synthesize execution details.",
          vetoConditions: [],
          walletActionProposal: {
            id: "wallet_action_forged_1",
            marketId: "screened_candidate_poly_1",
            action: "BUY_YES_SMALL",
            stake: {
              amount: "50.00",
              currency: "USDC",
            },
            rationale: "This did not come from an Agent Recommendation.",
          },
        } as unknown as DecisionScoringDraft,
        now: "2026-06-10T00:06:00.000Z",
        createFinalDecisionId: () => "decision_rejected_1",
      }),
    /Decision Scorer drafts cannot create wallet actions\./,
  );
});
