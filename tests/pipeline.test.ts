import assert from "node:assert/strict";
import test from "node:test";

import {
  createDecisionDossierAuditPayload,
  type AgentRecommendation,
  type CandidateMarket,
  type DecisionDossier,
  type EvidenceSnapshot,
  type FetchedPolymarketMarket,
  type FinalDecision,
  type ScreeningOutcome,
} from "../src/index.js";

const cannedMarket: FetchedPolymarketMarket = {
  id: "poly_1",
  question: "Will the Fed cut rates in July?",
  outcomes: ["YES", "NO"],
  prices: { YES: 0.92, NO: 0.08 },
  status: "active",
  volume: 100000,
  liquidity: 25000,
  closeTime: "2026-07-10T00:00:00.000Z",
  resolutionRules: "Resolves YES if the Fed cuts rates in July.",
  raw: {},
};

const cannedMarketStructureRecommendation: AgentRecommendation = {
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
    stake: { amount: "5.00", currency: "USDC" },
    rationale: "Market structure supports a small YES position.",
  },
  rationale: "Market structure supports a small YES position.",
  confidence: "MEDIUM",
  riskLevel: "LOW",
  evidenceRefs: ["screened_candidate_poly_1"],
  createdAt: "2026-06-10T00:05:00.000Z",
};

const cannedExternalRiskRecommendation: AgentRecommendation = {
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
    stake: { amount: "5.00", currency: "USDC" },
    rationale: "External context does not undermine the YES signal.",
  },
  rationale: "External context does not undermine the YES signal.",
  confidence: "HIGH",
  riskLevel: "LOW",
  evidenceRefs: ["context_candidate_poly_1_1"],
  createdAt: "2026-06-10T00:05:00.000Z",
};

test("happy path produces a DecisionDossier with BUY_YES_SMALL final decision and audit payload", async () => {
  const { runDecisionPipeline } = await import(
    "../src/pipeline.js"
  );

  const result = await runDecisionPipeline({
    topicText: "Fed rate cut",
    now: "2026-06-10T00:00:00.000Z",
    fetchMarkets: async () => [cannedMarket],
    queryTavily: async (_candidateMarket: CandidateMarket) => [
      {
        url: "https://example.com/fed-context",
        title: "Fed rate context",
        summary: "No major contrary evidence found.",
      },
    ],
    generateMarketStructureDraft: async (
      _evidenceSnapshot: EvidenceSnapshot,
    ) => ({
      action: "BUY_YES_SMALL" as const,
      targetMarketId: "screened_candidate_poly_1",
      rationale: "Market structure supports a small YES position.",
      confidence: "MEDIUM" as const,
      riskLevel: "LOW" as const,
      evidenceRefs: ["screened_candidate_poly_1"] as const,
    }),
    generateExternalRiskDraft: async (
      _evidenceSnapshot: EvidenceSnapshot,
    ) => ({
      action: "BUY_YES_SMALL" as const,
      targetMarketId: "screened_candidate_poly_1",
      rationale: "External context does not undermine the YES signal.",
      confidence: "HIGH" as const,
      riskLevel: "LOW" as const,
      evidenceRefs: ["context_candidate_poly_1_1"] as const,
      externalRiskFlags: [] as const,
    }),
    smallStakeAmount: "5.00",
    createTopicId: () => "topic_fed_rates",
    createScreeningId: () => "screening_fed_rates",
    createEvidenceSnapshotId: () => "snapshot_1",
    createDossierId: () => "dossier_1",
    createDecisionRunId: () => "run_1",
    createMarketStructureRecommendationId: () =>
      "rec_market_structure_1",
    createExternalRiskRecommendationId: () => "rec_external_risk_1",
    createWalletActionProposalId: () => "wallet_action_1",
    createFinalDecisionId: () => "decision_1",
  });

  assert.equal(result.kind, "decision_run_complete");

  const dossier: DecisionDossier = result.dossier;
  assert.equal(dossier.topic.text, "Fed rate cut");
  assert.equal(dossier.decisionRun.status, "FINAL_DECISION_SELECTED");
  assert.equal(dossier.evidenceSnapshot.marketEvidence.screenedMarkets.length, 1);
  assert.equal(
    dossier.evidenceSnapshot.marketEvidence.screenedMarkets[0].question,
    "Will the Fed cut rates in July?",
  );
  assert.equal(dossier.agentRecommendations.length, 2);
  assert.equal(dossier.finalDecision.action, "BUY_YES_SMALL");

  const finalDecision = dossier.finalDecision as FinalDecision & {
    walletActionProposal: { stake: { amount: string } };
  };
  assert.equal(
    finalDecision.walletActionProposal.stake.amount,
    "5.00",
  );

  const auditPayload = createDecisionDossierAuditPayload(dossier);
  assert.equal(auditPayload.dossierId, "dossier_1");
  assert.ok(auditPayload.hashes.dossier.hash.length > 0);
  assert.ok(auditPayload.hashes.evidenceSnapshot.hash.length > 0);
  assert.ok(auditPayload.hashes.finalDecision.hash.length > 0);
});

test("no Screened Market returns Screening Outcome without creating a Decision Run", async () => {
  const { runDecisionPipeline } = await import(
    "../src/pipeline.js"
  );

  const closedMarket: FetchedPolymarketMarket = {
    ...cannedMarket,
    status: "closed",
  };

  const result = await runDecisionPipeline({
    topicText: "Fed rate cut",
    now: "2026-06-10T00:00:00.000Z",
    fetchMarkets: async () => [closedMarket],
    queryTavily: async () => [],
    generateMarketStructureDraft: async () => ({
      action: "HOLD",
      rationale: "Not reached.",
      confidence: "LOW",
      riskLevel: "HIGH",
      evidenceRefs: [],
    }),
    generateExternalRiskDraft: async () => ({
      action: "HOLD",
      rationale: "Not reached.",
      confidence: "LOW",
      riskLevel: "HIGH",
      evidenceRefs: [],
      externalRiskFlags: [],
    }),
    smallStakeAmount: "5.00",
    createTopicId: () => "topic_fed_rates",
    createScreeningId: () => "screening_fed_rates",
    createEvidenceSnapshotId: () => "snapshot_1",
    createDossierId: () => "dossier_1",
    createDecisionRunId: () => "run_1",
    createMarketStructureRecommendationId: () => "rec_market_structure_1",
    createExternalRiskRecommendationId: () => "rec_external_risk_1",
    createWalletActionProposalId: () => "wallet_action_1",
    createFinalDecisionId: () => "decision_1",
  });

  assert.equal(result.kind, "screening_outcome");
  const outcome = (result as { kind: "screening_outcome"; outcome: ScreeningOutcome }).outcome;
  assert.equal(outcome.status, "NO_SCREENED_MARKETS");
});

test("veto conditions downgrade Final Decision to HOLD", async () => {
  const { runDecisionPipeline } = await import(
    "../src/pipeline.js"
  );

  const result = await runDecisionPipeline({
    topicText: "Fed rate cut",
    now: "2026-06-10T00:00:00.000Z",
    fetchMarkets: async () => [cannedMarket],
    queryTavily: async (_candidateMarket: CandidateMarket) => [
      {
        url: "https://example.com/fed-context",
        title: "Fed rate context",
        summary: "No major counterevidence found.",
      },
    ],
    generateMarketStructureDraft: async (
      _evidenceSnapshot: EvidenceSnapshot,
    ) => ({
      action: "BUY_YES_SMALL" as const,
      targetMarketId: "screened_candidate_poly_1",
      rationale: "Market structure supports YES.",
      confidence: "MEDIUM" as const,
      riskLevel: "LOW" as const,
      evidenceRefs: ["screened_candidate_poly_1"] as const,
    }),
    generateExternalRiskDraft: async (
      _evidenceSnapshot: EvidenceSnapshot,
    ) => ({
      action: "BUY_YES_SMALL" as const,
      targetMarketId: "screened_candidate_poly_1",
      rationale: "Context looks clean.",
      confidence: "MEDIUM" as const,
      riskLevel: "LOW" as const,
      evidenceRefs: ["context_candidate_poly_1_1"] as const,
      externalRiskFlags: [] as const,
    }),
    vetoConditions: ["MAJOR_EXTERNAL_COUNTEREVIDENCE"],
    smallStakeAmount: "5.00",
    createTopicId: () => "topic_fed_rates",
    createScreeningId: () => "screening_fed_rates",
    createEvidenceSnapshotId: () => "snapshot_1",
    createDossierId: () => "dossier_1",
    createDecisionRunId: () => "run_1",
    createMarketStructureRecommendationId: () => "rec_market_structure_1",
    createExternalRiskRecommendationId: () => "rec_external_risk_1",
    createWalletActionProposalId: () => "wallet_action_1",
    createFinalDecisionId: () => "decision_1",
  });

  assert.equal(result.kind, "decision_run_complete");
  const dossier = (result as { kind: "decision_run_complete"; dossier: DecisionDossier }).dossier;
  assert.equal(dossier.finalDecision.action, "HOLD");
  assert.ok(dossier.finalDecision.vetoConditions.includes("MAJOR_EXTERNAL_COUNTEREVIDENCE"));
});
