import { runDecisionPipeline, createDecisionDossierAuditPayload, type DecisionDossier, type EvidenceSnapshot, type CandidateMarket } from "../src/index.js";

const TOPIC = "Fed rate cut";

async function main() {
  console.log("═".repeat(60));
  console.log(`  ColdRead MVP — Decision Pipeline Demo`);
  console.log(`  Topic: "${TOPIC}"`);
  console.log("═".repeat(60));

  let counter = 0;
  const nextId = (prefix: string) => () => `${prefix}_${++counter}`;

  const result = await runDecisionPipeline({
    topicText: TOPIC,
    now: new Date().toISOString(),
    fetchMarkets: async () => [
      {
        id: "poly_fed_cuts_july",
        question: "Will the Fed cut interest rates in July 2026?",
        outcomes: ["YES", "NO"],
        prices: { YES: 0.88, NO: 0.12 },
        status: "active",
        volume: 1_200_000,
        liquidity: 350_000,
        closeTime: "2026-07-10T00:00:00.000Z",
        resolutionRules: "Resolves YES if the Federal Reserve announces a rate cut at its July 2026 meeting.",
        raw: {},
      },
    ],
    queryTavily: async (_: CandidateMarket) => [
      { url: "https://example.com/fed-outlook", title: "Fed Rate Outlook", summary: "Market consensus expects a cut in July. No major counterevidence found." },
    ],
    generateMarketStructureDraft: async (_snapshot: EvidenceSnapshot) => ({
      action: "BUY_YES_SMALL" as const,
      targetMarketId: "screened_candidate_poly_fed_cuts_july",
      rationale: "YES price 0.88 is strongly one-sided. Volume $1.2M and liquidity $350k support a small stake.",
      confidence: "MEDIUM" as const,
      riskLevel: "LOW" as const,
      evidenceRefs: ["screened_candidate_poly_fed_cuts_july"] as const,
    }),
    generateExternalRiskDraft: async (_snapshot: EvidenceSnapshot) => ({
      action: "BUY_YES_SMALL" as const,
      targetMarketId: "screened_candidate_poly_fed_cuts_july",
      rationale: "External context does not undermine the one-sided YES signal.",
      confidence: "HIGH" as const,
      riskLevel: "LOW" as const,
      evidenceRefs: ["context_candidate_poly_fed_cuts_july_1"] as const,
      externalRiskFlags: [] as const,
    }),
    smallStakeAmount: "5.00",
    createTopicId: nextId("topic"),
    createScreeningId: nextId("screening"),
    createEvidenceSnapshotId: nextId("snapshot"),
    createDossierId: nextId("dossier"),
    createDecisionRunId: nextId("run"),
    createMarketStructureRecommendationId: nextId("rec_ms"),
    createExternalRiskRecommendationId: nextId("rec_er"),
    createWalletActionProposalId: nextId("wallet"),
    createFinalDecisionId: nextId("decision"),
  });

  if (result.kind === "screening_outcome") {
    console.log(`\n  Result: SCREENING OUTCOME`);
    console.log(`  Status: ${result.outcome.status}`);
    console.log(`  Reason: ${result.outcome.reason}`);
    return;
  }

  const dossier: DecisionDossier = result.dossier;

  // ── Decision Timeline ──
  console.log(`\n  Decision Timeline:`);
  console.log(`  ─────────────────`);
  for (const entry of dossier.timeline) {
    console.log(`  ✓ ${entry.state.padEnd(36)} ${entry.at}`);
    if (entry.summary) console.log(`           ${entry.summary}`);
  }

  // ── Market Evidence ──
  console.log(`\n  Screened Markets:`);
  console.log(`  ─────────────────`);
  for (const m of dossier.evidenceSnapshot.marketEvidence.screenedMarkets) {
    console.log(`  ID:       ${m.id}`);
    console.log(`  Question: ${m.question}`);
    console.log(`  Prices:   YES ${(m.prices.yes * 100).toFixed(0)}% / NO ${(m.prices.no * 100).toFixed(0)}%`);
    console.log(`  Volume:   $${m.volume.toLocaleString()}`);
    console.log(`  Liquidity: $${m.liquidity.toLocaleString()}`);
    console.log(`  Signal:   ${m.oneSidedSignal.side} @ ${(m.oneSidedSignal.price * 100).toFixed(0)}%`);
    console.log(`  Closes:   ${m.closeTime}`);
    console.log(`  Rules:    ${m.resolutionRules}`);
    console.log(`  Confirm:  ${m.confirmationRationale}`);
  }

  // ── Agent Recommendations ──
  console.log(`\n  Agent Recommendations:`);
  console.log(`  ──────────────────────`);
  for (const rec of dossier.agentRecommendations) {
    console.log(`  [${rec.analysisLens}]  ${rec.action}`);
    console.log(`    Confidence:     ${rec.confidence}`);
    console.log(`    Risk Level:     ${rec.riskLevel}`);
    console.log(`    Rationale:      ${rec.rationale}`);
    if (rec.action !== "HOLD" && "walletActionProposal" in rec) {
      const wap = (rec as typeof rec & { walletActionProposal: { stake: { amount: string; currency: string } } }).walletActionProposal;
      console.log(`    Proposed Stake: ${wap.stake.amount} ${wap.stake.currency}`);
    }
  }

  // ── Final Decision ──
  console.log(`\n  Final Decision:`);
  console.log(`  ───────────────`);
  console.log(`  Action:   ${dossier.finalDecision.action}`);
  console.log(`  Rationale: ${dossier.finalDecision.rationale}`);
  if (dossier.finalDecision.vetoConditions.length > 0) {
    console.log(`  Veto:     ${dossier.finalDecision.vetoConditions.join(", ")}`);
  }
  if (dossier.finalDecision.action !== "HOLD" && "walletActionProposal" in dossier.finalDecision) {
    const wap = (dossier.finalDecision as typeof dossier.finalDecision & { walletActionProposal: { stake: { amount: string; currency: string } } }).walletActionProposal;
    console.log(`  Stake:    ${wap.stake.amount} ${wap.stake.currency}`);
  }

  // ── Audit Hashes ──
  const auditPayload = createDecisionDossierAuditPayload(dossier);
  console.log(`\n  Audit Payload Hashes (sha256):`);
  console.log(`  ───────────────────────────────`);
  console.log(`  Dossier:              ${auditPayload.hashes.dossier.hash}`);
  console.log(`  Evidence Snapshot:    ${auditPayload.hashes.evidenceSnapshot.hash}`);
  console.log(`  Agent Recommendations: ${auditPayload.hashes.agentRecommendations.hash}`);
  console.log(`  Final Decision:       ${auditPayload.hashes.finalDecision.hash}`);

  // ── MVP Disclosure ──
  console.log(`\n  MVP records approval and audit metadata; it does not place real prediction market trades.`);
  console.log(`\n${"═".repeat(60)}`);
}

main().catch(console.error);
