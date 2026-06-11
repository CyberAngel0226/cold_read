import assert from "node:assert/strict";
import test from "node:test";

import {
  createAuditAnchorRequest,
  createDecisionDossierAuditPayload,
  recordAuditAnchorMetadata,
  type AgentRecommendation,
  type DecisionDossier,
  type EvidenceSnapshot,
  type FinalDecision,
} from "../src/index.js";
import { timelineEntries } from "./helpers.js";

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
  finalDecision,
  auditAnchors: [],
  timeline: timelineEntries([
    "topic_received",
    "markets_fetched",
    "candidate_markets_screened",
    "high_conviction_markets_confirmed",
    "evidence_snapshot_created",
    "agent_recommendations_created",
    "final_decision_selected",
  ]),
};

test("constructs a minimal Audit Anchor request from Decision Dossier hashes", () => {
  const auditPayload = createDecisionDossierAuditPayload(decisionDossier);

  const anchorRequest = createAuditAnchorRequest({
    auditPayload,
    network: "testnet",
  });

  assert.deepEqual(anchorRequest, {
    version: "coldread.audit-anchor.v1",
    network: "testnet",
    decisionRunId: "run_1",
    dossierId: "dossier_1",
    contentHash: auditPayload.hashes.dossier.hash,
    hashAlgorithm: "sha256",
    canonicalization: "coldread-json-v1",
    sectionHashes: {
      agentRecommendations: auditPayload.hashes.agentRecommendations.hash,
      evidenceSnapshot: auditPayload.hashes.evidenceSnapshot.hash,
      finalDecision: auditPayload.hashes.finalDecision.hash,
    },
  });
  assert.equal(JSON.stringify(anchorRequest).includes("Fed rate cut"), false);
  assert.equal(JSON.stringify(anchorRequest).includes("Market structure supports"), false);
});

test("records returned Audit Anchor metadata on the Decision Dossier", () => {
  const auditPayload = createDecisionDossierAuditPayload(decisionDossier);
  const anchorRequest = createAuditAnchorRequest({
    auditPayload,
    network: "testnet",
  });

  const result = recordAuditAnchorMetadata({
    decisionDossier,
    anchorRequest,
    chainMetadata: {
      network: "testnet",
      transactionHash: "0xtx_1",
    },
    now: "2026-06-10T00:08:00.000Z",
    createAuditAnchorId: () => "anchor_1",
  });

  assert.deepEqual(result.auditAnchor, {
    id: "anchor_1",
    decisionRunId: "run_1",
    network: "testnet",
    contentHash: anchorRequest.contentHash,
    transactionHash: "0xtx_1",
    anchoredAt: "2026-06-10T00:08:00.000Z",
  });
  assert.deepEqual(result.decisionDossier.auditAnchors, [result.auditAnchor]);
  assert.equal(result.decisionDossier.decisionRun.status, "AUDIT_ANCHOR_WRITTEN");
  assert.equal(
    result.decisionDossier.timeline.at(-1)?.state,
    "audit_anchor_written",
  );
});

test("records Audit Anchor metadata when no transaction hash is returned", () => {
  const auditPayload = createDecisionDossierAuditPayload(decisionDossier);
  const anchorRequest = createAuditAnchorRequest({
    auditPayload,
    network: "testnet",
  });

  const result = recordAuditAnchorMetadata({
    decisionDossier,
    anchorRequest,
    chainMetadata: {
      network: "testnet",
    },
    now: "2026-06-10T00:08:00.000Z",
    createAuditAnchorId: () => "anchor_dry_run_1",
  });

  assert.deepEqual(result.auditAnchor, {
    id: "anchor_dry_run_1",
    decisionRunId: "run_1",
    network: "testnet",
    contentHash: anchorRequest.contentHash,
    anchoredAt: "2026-06-10T00:08:00.000Z",
  });
  assert.equal("transactionHash" in result.auditAnchor, false);
  assert.deepEqual(result.decisionDossier.auditAnchors, [result.auditAnchor]);
});
