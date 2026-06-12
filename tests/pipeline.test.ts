import assert from "node:assert/strict";
import test from "node:test";

import {
  createDecisionDossierAuditPayload,
  type AgentRecommendation,
  type AuditAnchor,
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
    createMarketStructureRecommendationId: () => "rec_market_structure_1",
    createExternalRiskRecommendationId: () => "rec_external_risk_1",
    createWalletActionProposalId: () => "wallet_action_1",
    createFinalDecisionId: () => "decision_1",
    createAuditAnchorId: () => "anchor_1",
    createUserApprovalId: () => "approval_1",
    createExecutionRecordId: () => "execution_1",
  });

  assert.equal(result.kind, "decision_run_complete");

  const dossier: DecisionDossier = result.dossier;
  assert.equal(dossier.topic.text, "Fed rate cut");
  assert.equal(dossier.decisionRun.status, "AUDIT_ANCHOR_WRITTEN");
  assert.equal(dossier.evidenceSnapshot.marketEvidence.screenedMarkets.length, 1);
  assert.equal(
    dossier.evidenceSnapshot.marketEvidence.screenedMarkets[0].question,
    "Will the Fed cut rates in July?",
  );
  assert.equal(dossier.agentRecommendations.length, 2);
  assert.equal(dossier.finalDecision.action, "BUY_YES_SMALL");
  assert.equal(dossier.auditAnchors.length, 1);
  assert.equal(dossier.auditAnchors[0].id, "anchor_1");
  assert.equal(dossier.auditAnchors[0].network, "testnet");

  const states = dossier.timeline.map((e) => e.state);
  assert.ok(states.includes("audit_anchor_written"));

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
      action: "HOLD" as const,
      rationale: "Not reached.",
      confidence: "LOW" as const,
      riskLevel: "HIGH" as const,
      evidenceRefs: [] as const,
    }),
    generateExternalRiskDraft: async () => ({
      action: "HOLD" as const,
      rationale: "Not reached.",
      confidence: "LOW" as const,
      riskLevel: "HIGH" as const,
      evidenceRefs: [] as const,
      externalRiskFlags: [] as const,
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
    createAuditAnchorId: () => "anchor_1",
    createUserApprovalId: () => "approval_1",
    createExecutionRecordId: () => "execution_1",
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
    createAuditAnchorId: () => "anchor_1",
    createUserApprovalId: () => "approval_1",
    createExecutionRecordId: () => "execution_1",
  });

  assert.equal(result.kind, "decision_run_complete");
  const dossier = (result as { kind: "decision_run_complete"; dossier: DecisionDossier }).dossier;
  assert.equal(dossier.finalDecision.action, "HOLD");
  assert.ok(dossier.finalDecision.vetoConditions.includes("MAJOR_EXTERNAL_COUNTEREVIDENCE"));
  assert.equal(dossier.auditAnchors.length, 1);
  assert.equal(dossier.decisionRun.status, "AUDIT_ANCHOR_WRITTEN");
});

test("pipeline records audit anchor on the dossier after Final Decision", async () => {
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
    createMarketStructureRecommendationId: () => "rec_market_structure_1",
    createExternalRiskRecommendationId: () => "rec_external_risk_1",
    createWalletActionProposalId: () => "wallet_action_1",
    createFinalDecisionId: () => "decision_1",
    createAuditAnchorId: () => "anchor_1",
    createUserApprovalId: () => "approval_1",
    createExecutionRecordId: () => "execution_1",
  });

  assert.equal(result.kind, "decision_run_complete");
  const dossier = (result as { kind: "decision_run_complete"; dossier: DecisionDossier }).dossier;

  assert.equal(dossier.decisionRun.status, "AUDIT_ANCHOR_WRITTEN");
  assert.equal(dossier.auditAnchors.length, 1);
  const anchor: AuditAnchor = dossier.auditAnchors[0];
  assert.equal(anchor.id, "anchor_1");
  assert.equal(anchor.network, "testnet");
  assert.ok(anchor.contentHash.length > 0);

  const states = dossier.timeline.map((e) => e.state);
  assert.ok(states.includes("audit_anchor_written"));
  assert.ok(!states.includes("user_approval_recorded"));
  assert.ok(!states.includes("execution_record_created"));
});

test("BUY_YES_SMALL path records User Approval and deferred Execution Record", async () => {
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
    approvedBy: "user_1",
    createTopicId: () => "topic_fed_rates",
    createScreeningId: () => "screening_fed_rates",
    createEvidenceSnapshotId: () => "snapshot_1",
    createDossierId: () => "dossier_1",
    createDecisionRunId: () => "run_1",
    createMarketStructureRecommendationId: () => "rec_market_structure_1",
    createExternalRiskRecommendationId: () => "rec_external_risk_1",
    createWalletActionProposalId: () => "wallet_action_1",
    createFinalDecisionId: () => "decision_1",
    createAuditAnchorId: () => "anchor_1",
    createUserApprovalId: () => "approval_1",
    createExecutionRecordId: () => "execution_1",
  });

  assert.equal(result.kind, "decision_run_complete");
  const dossier = (result as { kind: "decision_run_complete"; dossier: DecisionDossier }).dossier;

  assert.equal(dossier.decisionRun.status, "EXECUTION_RECORD_CREATED");
  assert.notEqual(dossier.userApproval, undefined);
  assert.equal(dossier.userApproval!.approvedBy, "user_1");
  assert.equal(dossier.userApproval!.id, "approval_1");
  assert.notEqual(dossier.executionRecord, undefined);
  assert.equal(dossier.executionRecord!.status, "DEFERRED_FOR_MVP");
  assert.equal(dossier.executionRecord!.id, "execution_1");

  const states = dossier.timeline.map((e) => e.state);
  assert.ok(states.includes("user_approval_recorded"));
  assert.ok(states.includes("execution_record_created"));
});
