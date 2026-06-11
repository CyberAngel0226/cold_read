import assert from "node:assert/strict";
import test from "node:test";

import {
  getUserApprovalView,
  recordUserApproval,
  type AgentRecommendation,
  type DecisionDossier,
  type EvidenceSnapshot,
  type FinalDecision,
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
        prices: { yes: 0.92, no: 0.08 },
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
  contextEvidence: { items: [] },
};

const agentRecommendation: AgentRecommendation = {
  id: "rec_market_structure_1",
  decisionRunId: "run_1",
  evidenceSnapshotId: "snapshot_1",
  analysisLens: "MARKET_STRUCTURE",
  action: "BUY_YES_SMALL",
  targetMarketId: "screened_candidate_poly_1",
  walletActionProposal: {
    id: "wallet_action_1",
    marketId: "screened_candidate_poly_1",
    action: "BUY_YES_SMALL",
    stake: { amount: "5.00", currency: "USDC" },
    rationale: "Market structure supports a small YES position.",
  },
  rationale: "Market structure supports a small YES position.",
  confidence: "MEDIUM",
  riskLevel: "LOW",
  evidenceRefs: ["screened_candidate_poly_1"],
  createdAt: "2026-06-10T00:05:00.000Z",
};

const buyFinalDecision: FinalDecision = {
  id: "decision_1",
  decisionRunId: "run_1",
  selectedRecommendationId: "rec_market_structure_1",
  action: "BUY_YES_SMALL",
  rationale: "Selected the market structure recommendation.",
  vetoConditions: [],
  walletActionProposal: agentRecommendation.walletActionProposal,
  createdAt: "2026-06-10T00:06:00.000Z",
};

const decisionDossier: DecisionDossier = {
  id: "dossier_1",
  topic: {
    id: "topic_1",
    text: "Fed rate cut",
    submittedBy: "user_1",
    receivedAt: "2026-06-10T00:00:00.000Z",
  },
  decisionRun: {
    kind: "decision_run",
    id: "run_1",
    topicId: "topic_1",
    screenedMarketIds: ["screened_candidate_poly_1"],
    status: "FINAL_DECISION_SELECTED",
    createdAt: "2026-06-10T00:03:00.000Z",
  },
  evidenceSnapshot,
  agentRecommendations: [agentRecommendation],
  finalDecision: buyFinalDecision,
  auditAnchors: [],
  timeline: [
    "topic_received",
    "markets_fetched",
    "candidate_markets_screened",
    "high_conviction_markets_confirmed",
    "evidence_snapshot_created",
    "agent_recommendations_created",
    "final_decision_selected",
  ],
};

test("records User Approval and deferred Execution Record for a BUY Final Decision", () => {
  let executionCalls = 0;

  const result = recordUserApproval({
    decisionDossier,
    approvedBy: "user_1",
    now: "2026-06-10T00:07:00.000Z",
    createUserApprovalId: () => "approval_1",
    createExecutionRecordId: () => "execution_1",
    executeWalletAction: () => {
      executionCalls += 1;
    },
  });

  assert.equal(executionCalls, 0);
  assert.deepEqual(result.userApproval, {
    id: "approval_1",
    decisionRunId: "run_1",
    finalDecisionId: "decision_1",
    walletActionProposalId: "wallet_action_1",
    approvedBy: "user_1",
    approvedAt: "2026-06-10T00:07:00.000Z",
  });
  assert.deepEqual(result.executionRecord, {
    id: "execution_1",
    decisionRunId: "run_1",
    finalDecisionId: "decision_1",
    userApprovalId: "approval_1",
    status: "DEFERRED_FOR_MVP",
    note: "User approved the proposed wallet action, but MVP does not place real prediction market trades.",
    createdAt: "2026-06-10T00:07:00.000Z",
  });
  assert.deepEqual(result.decisionDossier.userApproval, result.userApproval);
  assert.deepEqual(result.decisionDossier.executionRecord, result.executionRecord);
  assert.equal(result.decisionDossier.decisionRun.status, "EXECUTION_RECORD_CREATED");
  assert.deepEqual(result.decisionDossier.timeline.slice(-2), [
    "user_approval_recorded",
    "execution_record_created",
  ]);
});

test("rejects User Approval for a HOLD Final Decision", () => {
  const holdDossier: DecisionDossier = {
    ...decisionDossier,
    finalDecision: {
      id: "decision_hold_1",
      decisionRunId: "run_1",
      action: "HOLD",
      rationale: "Veto conditions require holding.",
      vetoConditions: ["WEAK_AGENT_CONVERGENCE"],
      createdAt: "2026-06-10T00:06:00.000Z",
    },
  };
  let executionCalls = 0;

  assert.throws(
    () =>
      recordUserApproval({
        decisionDossier: holdDossier,
        approvedBy: "user_1",
        now: "2026-06-10T00:07:00.000Z",
        createUserApprovalId: () => "approval_hold_1",
        createExecutionRecordId: () => "execution_hold_1",
        executeWalletAction: () => {
          executionCalls += 1;
        },
      }),
    /HOLD decisions do not offer execution approval\./,
  );
  assert.equal(executionCalls, 0);
});

test("describes approval availability and MVP deferred execution copy", () => {
  assert.deepEqual(getUserApprovalView(buyFinalDecision), {
    canApproveExecution: true,
    walletActionProposal: buyFinalDecision.walletActionProposal,
    approvalLabel: "Approve proposed execution plan",
    mvpDisclosure:
      "MVP records approval and defers execution; it does not place real prediction market trades.",
  });

  assert.deepEqual(
    getUserApprovalView({
      id: "decision_hold_1",
      decisionRunId: "run_1",
      action: "HOLD",
      rationale: "Veto conditions require holding.",
      vetoConditions: ["WEAK_AGENT_CONVERGENCE"],
      createdAt: "2026-06-10T00:06:00.000Z",
    }),
    {
      canApproveExecution: false,
      approvalLabel: undefined,
      mvpDisclosure:
        "No execution approval is available because the Final Decision is HOLD.",
    },
  );
});
