import assert from "node:assert/strict";
import test from "node:test";

import {
  canonicalizeAuditPayload,
  createDecisionDossierAuditPayload,
  hashAuditPayload,
  type AgentRecommendation,
  type DecisionDossier,
  type EvidenceSnapshot,
  type ExecutionRecord,
  type FinalDecision,
} from "../src/index.js";

test("canonical audit payloads are stable for equivalent object key order", () => {
  const left = {
    id: "snapshot_1",
    decisionRunId: "run_1",
    nested: {
      b: 2,
      a: 1,
    },
  };
  const right = {
    nested: {
      a: 1,
      b: 2,
    },
    decisionRunId: "run_1",
    id: "snapshot_1",
  };

  assert.equal(canonicalizeAuditPayload(left), canonicalizeAuditPayload(right));
  assert.equal(hashAuditPayload(left), hashAuditPayload(right));
});

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

const agentRecommendation: AgentRecommendation = {
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

const agentRecommendations: readonly AgentRecommendation[] = [agentRecommendation];

const finalDecision: FinalDecision = {
  id: "decision_1",
  decisionRunId: "run_1",
  selectedRecommendationId: "rec_market_structure_1",
  action: "BUY_YES_SMALL",
  rationale: "Selected the market structure recommendation.",
  vetoConditions: [],
  walletActionProposal: agentRecommendation.walletActionProposal,
  createdAt: "2026-06-10T00:06:00.000Z",
};

const executionRecord: ExecutionRecord = {
  id: "execution_1",
  decisionRunId: "run_1",
  finalDecisionId: "decision_1",
  status: "DEFERRED_FOR_MVP",
  note: "User approval is deferred for MVP.",
  createdAt: "2026-06-10T00:07:00.000Z",
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
  agentRecommendations,
  finalDecision,
  auditAnchors: [],
  executionRecord,
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

test("creates Decision Dossier audit payload hash metadata for audit-relevant sections", () => {
  const auditPayload = createDecisionDossierAuditPayload(decisionDossier);

  assert.equal(auditPayload.dossierId, "dossier_1");
  assert.equal(auditPayload.decisionRunId, "run_1");
  assert.deepEqual(Object.keys(auditPayload.sections), [
    "agentRecommendations",
    "evidenceSnapshot",
    "executionRecord",
    "finalDecision",
  ]);
  assert.deepEqual(Object.keys(auditPayload.hashes), [
    "agentRecommendations",
    "dossier",
    "evidenceSnapshot",
    "executionRecord",
    "finalDecision",
  ]);
  assert.equal(
    auditPayload.hashes.evidenceSnapshot.hash,
    hashAuditPayload(evidenceSnapshot),
  );
  assert.equal(
    auditPayload.hashes.agentRecommendations.hash,
    hashAuditPayload(agentRecommendations),
  );
  assert.equal(
    auditPayload.hashes.finalDecision.hash,
    hashAuditPayload(finalDecision),
  );
  assert.equal(
    auditPayload.hashes.executionRecord?.hash,
    hashAuditPayload(executionRecord),
  );
});

test("audit hashes change when audit-relevant content changes", () => {
  const original = createDecisionDossierAuditPayload(decisionDossier);
  const mutated = createDecisionDossierAuditPayload({
    ...decisionDossier,
    finalDecision: {
      ...decisionDossier.finalDecision,
      rationale: "Mutated final decision rationale.",
    },
  });

  assert.notEqual(
    original.hashes.finalDecision.hash,
    mutated.hashes.finalDecision.hash,
  );
  assert.notEqual(original.hashes.dossier.hash, mutated.hashes.dossier.hash);
  assert.equal(
    original.hashes.evidenceSnapshot.hash,
    mutated.hashes.evidenceSnapshot.hash,
  );
});

test("omits execution record audit metadata when the dossier has no Execution Record", () => {
  const { executionRecord: _executionRecord, ...dossierWithoutExecution } =
    decisionDossier;

  const auditPayload = createDecisionDossierAuditPayload(dossierWithoutExecution);

  assert.equal("executionRecord" in auditPayload.sections, false);
  assert.equal("executionRecord" in auditPayload.hashes, false);
});
