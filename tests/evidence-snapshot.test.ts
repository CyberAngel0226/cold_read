import assert from "node:assert/strict";
import test from "node:test";

import {
  freezeEvidenceSnapshot,
  type ContextEvidenceItem,
  type DecisionRun,
  type DecisionTopic,
  type HighConvictionMarketsConfirmedResult,
  type ScreenedMarket,
} from "../src/index.js";

const topic: DecisionTopic = {
  id: "topic_fed_rates",
  text: "Fed rate cut",
  submittedBy: "user_1",
  receivedAt: "2026-06-10T00:00:00.000Z",
};

const screenedMarket: ScreenedMarket = {
  id: "screened_candidate_poly_1",
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
};

const contextEvidenceItem: ContextEvidenceItem = {
  id: "context_candidate_poly_1_1",
  marketId: "candidate_poly_1",
  sourceUrl: "https://example.com/fed-context",
  title: "Fed rate context",
  summary: "Recent public statements do not show a major reversal risk.",
  retrievedAt: "2026-06-10T00:03:00.000Z",
};

const decisionRun: DecisionRun = {
  kind: "decision_run",
  id: "run_1",
  topicId: "topic_fed_rates",
  screenedMarketIds: ["screened_candidate_poly_1"],
  status: "CREATED",
  createdAt: "2026-06-10T00:03:00.000Z",
};

const highConvictionMarketsConfirmed: HighConvictionMarketsConfirmedResult = {
  kind: "high_conviction_markets_confirmed",
  screenedMarkets: [screenedMarket],
  contextEvidenceItems: [contextEvidenceItem],
  decisionRun,
  timeline: [
    "topic_received",
    "markets_fetched",
    "candidate_markets_screened",
    "high_conviction_markets_confirmed",
  ],
};

test("freezes Screened Markets and context evidence into an Evidence Snapshot and Decision Dossier draft", () => {
  const result = freezeEvidenceSnapshot({
    topic,
    highConvictionMarketsConfirmed,
    now: "2026-06-10T00:04:00.000Z",
    createEvidenceSnapshotId: () => "snapshot_1",
    createDecisionDossierDraftId: () => "dossier_1",
  });

  assert.deepEqual(result.evidenceSnapshot, {
    id: "snapshot_1",
    decisionRunId: "run_1",
    createdAt: "2026-06-10T00:04:00.000Z",
    marketEvidence: {
      screenedMarkets: [screenedMarket],
    },
    contextEvidence: {
      items: [contextEvidenceItem],
    },
  });
  assert.deepEqual(result.decisionRun, {
    ...decisionRun,
    status: "EVIDENCE_SNAPSHOT_CREATED",
  });
  assert.deepEqual(result.decisionDossierDraft, {
    id: "dossier_1",
    topic,
    decisionRun: {
      ...decisionRun,
      status: "EVIDENCE_SNAPSHOT_CREATED",
    },
    evidenceSnapshot: result.evidenceSnapshot,
    timeline: [
      "topic_received",
      "markets_fetched",
      "candidate_markets_screened",
      "high_conviction_markets_confirmed",
      "evidence_snapshot_created",
    ],
  });
});

test("downstream analysis receives the same frozen Evidence Snapshot reference", () => {
  const result = freezeEvidenceSnapshot({
    topic,
    highConvictionMarketsConfirmed,
    now: "2026-06-10T00:04:00.000Z",
    createEvidenceSnapshotId: () => "snapshot_1",
    createDecisionDossierDraftId: () => "dossier_1",
  });

  const marketStructureSnapshot = result.analysisEvidenceSnapshot;
  const externalRiskSnapshot = result.analysisEvidenceSnapshot;

  assert.equal(marketStructureSnapshot, result.evidenceSnapshot);
  assert.equal(externalRiskSnapshot, result.evidenceSnapshot);
  assert.equal(marketStructureSnapshot.id, "snapshot_1");
});

test("does not create an Evidence Snapshot when no Screened Market exists", () => {
  assert.throws(
    () =>
      freezeEvidenceSnapshot({
        topic,
        highConvictionMarketsConfirmed: {
          ...highConvictionMarketsConfirmed,
          screenedMarkets: [],
          decisionRun: {
            ...decisionRun,
            screenedMarketIds: [],
          },
        },
        now: "2026-06-10T00:04:00.000Z",
        createEvidenceSnapshotId: () => "snapshot_1",
        createDecisionDossierDraftId: () => "dossier_1",
      }),
    /Evidence Snapshot requires at least one Screened Market\./,
  );
});
