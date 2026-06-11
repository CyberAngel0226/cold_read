import assert from "node:assert/strict";
import test from "node:test";

import {
  renderDecisionTimeline,
  renderScreeningOutcomeTimeline,
  type DecisionDossier,
  type FinalDecision,
  type ScreeningOutcome,
} from "../src/index.js";
import { timelineEntries, timelineStates } from "./helpers.js";

const fullTimelineStates = [
  "topic_received",
  "markets_fetched",
  "candidate_markets_screened",
  "high_conviction_markets_confirmed",
  "evidence_snapshot_created",
  "agent_recommendations_created",
  "final_decision_selected",
  "audit_anchor_written",
  "user_approval_recorded",
  "execution_record_created",
] as const;

const buyFinalDecision: FinalDecision = {
  id: "decision_1",
  decisionRunId: "run_1",
  selectedRecommendationId: "rec_market_structure_1",
  action: "BUY_YES_SMALL",
  rationale: "Selected the market structure recommendation.",
  vetoConditions: [],
  walletActionProposal: {
    id: "wallet_action_1",
    marketId: "screened_candidate_poly_1",
    action: "BUY_YES_SMALL",
    stake: {
      amount: "5.00",
      currency: "USDC",
    },
    rationale: "Market structure supports a small YES position.",
  },
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
    status: "EXECUTION_RECORD_CREATED",
    createdAt: "2026-06-10T00:03:00.000Z",
  },
  evidenceSnapshot: {
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
  },
  agentRecommendations: [
    {
      id: "rec_market_structure_1",
      decisionRunId: "run_1",
      evidenceSnapshotId: "snapshot_1",
      analysisLens: "MARKET_STRUCTURE",
      action: "BUY_YES_SMALL",
      targetMarketId: "screened_candidate_poly_1",
      walletActionProposal: buyFinalDecision.walletActionProposal,
      rationale: "Market structure supports a small YES position.",
      confidence: "MEDIUM",
      riskLevel: "LOW",
      evidenceRefs: ["screened_candidate_poly_1"],
      createdAt: "2026-06-10T00:05:00.000Z",
    },
  ],
  finalDecision: buyFinalDecision,
  auditAnchors: [
    {
      id: "anchor_1",
      decisionRunId: "run_1",
      network: "testnet",
      contentHash: "0x1234",
      transactionHash: "0xtx_1",
      anchoredAt: "2026-06-10T00:08:00.000Z",
    },
  ],
  userApproval: {
    id: "approval_1",
    decisionRunId: "run_1",
    finalDecisionId: "decision_1",
    walletActionProposalId: "wallet_action_1",
    approvedBy: "user_1",
    approvedAt: "2026-06-10T00:09:00.000Z",
  },
  executionRecord: {
    id: "execution_1",
    decisionRunId: "run_1",
    finalDecisionId: "decision_1",
    userApprovalId: "approval_1",
    status: "DEFERRED_FOR_MVP",
    note: "MVP does not place real prediction market trades.",
    createdAt: "2026-06-10T00:09:00.000Z",
  },
  timeline: timelineEntries(fullTimelineStates),
};

test("renders the complete Decision Timeline as the primary frontend view", () => {
  const view = renderDecisionTimeline(decisionDossier);

  assert.equal(view.kind, "decision_timeline");
  assert.deepEqual(
    view.steps.map((step) => step.state),
    fullTimelineStates,
  );
  assert.deepEqual(
    view.steps.map((step) => step.status),
    fullTimelineStates.map(() => "complete"),
  );
  assert.equal(view.finalDecision.action, "BUY_YES_SMALL");
  assert.equal(view.userApproval?.approvedBy, "user_1");
  assert.equal(view.executionRecord?.status, "DEFERRED_FOR_MVP");
  assert.match(view.mvpDisclosure, /does not place real prediction market trades/);
});

test("renders no-Screened-Market as a Screening Outcome instead of a broken timeline", () => {
  const screeningOutcome: ScreeningOutcome = {
    kind: "screening_outcome",
    topicId: "topic_1",
    status: "NO_SCREENED_MARKETS",
    reason: "No Candidate Markets passed the Polymarket-only hard gates.",
    rejectedMarketCount: 2,
    createdAt: "2026-06-10T00:02:00.000Z",
  };

  const view = renderScreeningOutcomeTimeline({
    topic: decisionDossier.topic,
    screeningOutcome,
    timeline: timelineEntries([
      "topic_received",
      "markets_fetched",
      "candidate_markets_screened",
    ]),
  });

  assert.equal(view.kind, "screening_outcome");
  assert.equal(view.decisionRun, undefined);
  assert.equal(view.screeningOutcome.reason, screeningOutcome.reason);
  assert.deepEqual(timelineStates(view.timeline), [
    "topic_received",
    "markets_fetched",
    "candidate_markets_screened",
  ]);
  assert.equal(view.steps.at(-1)?.summary, screeningOutcome.reason);
});

test("renders Veto downgrade as a HOLD Final Decision without execution approval", () => {
  const vetoDossier: DecisionDossier = {
    ...decisionDossier,
    finalDecision: {
      id: "decision_hold_1",
      decisionRunId: "run_1",
      action: "HOLD",
      rationale: "Downgraded to HOLD because veto conditions appeared.",
      vetoConditions: ["MAJOR_EXTERNAL_COUNTEREVIDENCE"],
      createdAt: "2026-06-10T00:06:00.000Z",
    },
    userApproval: undefined,
    executionRecord: undefined,
    timeline: timelineEntries(fullTimelineStates.slice(0, 7)),
  };

  const view = renderDecisionTimeline(vetoDossier);

  assert.equal(view.finalDecision.action, "HOLD");
  assert.deepEqual(view.finalDecision.vetoConditions, [
    "MAJOR_EXTERNAL_COUNTEREVIDENCE",
  ]);
  assert.equal(view.approval.canApproveExecution, false);
  assert.equal(view.userApproval, undefined);
  assert.equal(view.executionRecord, undefined);
});

test("renders deferred execution after User Approval without implying a real trade", () => {
  const view = renderDecisionTimeline(decisionDossier);

  assert.equal(view.approval.canApproveExecution, true);
  assert.equal(view.executionRecord?.status, "DEFERRED_FOR_MVP");
  assert.equal(view.executionRecord?.userApprovalId, "approval_1");
  assert.match(view.executionRecord?.note ?? "", /does not place real/);
});
