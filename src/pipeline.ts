import type {
  CandidateMarket,
  DecisionDossier,
  EvidenceSnapshot,
  IsoTimestamp,
  ScreeningOutcome,
  VetoCondition,
} from "./domain.js";
import { createDecisionTopicIntake } from "./decision-topic-intake.js";
import type { FetchedPolymarketMarket } from "./polymarket-market-fetch.js";
import {
  screenCandidateMarketsForTopic,
} from "./candidate-market-screener.js";
import {
  confirmScreenedMarketsWithTavily,
  type TavilyContextItem,
} from "./tavily-market-confirmation.js";
import { freezeEvidenceSnapshot } from "./evidence-snapshot.js";
import {
  adaptMarketStructureDraft,
  type MarketStructureRecommendationDraft,
} from "./market-structure-lens.js";
import {
  adaptExternalRiskDraft,
  type ExternalRiskRecommendationDraft,
} from "./external-risk-lens.js";
import { selectFinalDecision } from "./decision-scorer.js";
import { createDecisionDossierAuditPayload } from "./decision-dossier-audit.js";
import {
  createAuditAnchorRequest,
  recordAuditAnchorMetadata,
} from "./audit-anchor.js";
import { recordUserApproval } from "./user-approval.js";
import { appendTimelineEntry } from "./decision-timeline.js";
import type { AgentRecommendation } from "./domain.js";

export type RunDecisionPipelineInput = {
  topicText: string;
  now: IsoTimestamp;
  fetchMarkets: (topicText: string) => Promise<readonly FetchedPolymarketMarket[]>;
  queryTavily: (
    candidateMarket: CandidateMarket,
  ) => Promise<readonly TavilyContextItem[]>;
  generateMarketStructureDraft: (
    evidenceSnapshot: EvidenceSnapshot,
  ) => Promise<MarketStructureRecommendationDraft>;
  generateExternalRiskDraft: (
    evidenceSnapshot: EvidenceSnapshot,
  ) => Promise<ExternalRiskRecommendationDraft>;
  smallStakeAmount: string;
  approvedBy?: string;
  vetoConditions?: readonly VetoCondition[];
  minimumLiquidity?: number;
  minimumHoursUntilClose?: number;
  oneSidedPriceThreshold?: number;
  createTopicId: () => string;
  createScreeningId: () => string;
  createEvidenceSnapshotId: () => string;
  createDossierId: () => string;
  createDecisionRunId: () => string;
  createMarketStructureRecommendationId: () => string;
  createExternalRiskRecommendationId: () => string;
  createWalletActionProposalId: () => string;
  createFinalDecisionId: () => string;
  createAuditAnchorId: () => string;
  createUserApprovalId: () => string;
  createExecutionRecordId: () => string;
};

export type DecisionRunCompleteResult = {
  kind: "decision_run_complete";
  dossier: DecisionDossier;
};

export type ScreeningOutcomeResult = {
  kind: "screening_outcome";
  outcome: ScreeningOutcome;
};

export type PipelineResult = DecisionRunCompleteResult | ScreeningOutcomeResult;

export async function runDecisionPipeline(
  input: RunDecisionPipelineInput,
): Promise<PipelineResult> {
  const intake = createDecisionTopicIntake({
    id: input.createTopicId(),
    text: input.topicText,
    now: input.now,
  });

  const markets = await input.fetchMarkets(input.topicText);

  const screeningResult = screenCandidateMarketsForTopic({
    intake,
    markets,
    now: input.now,
    minimumLiquidity: input.minimumLiquidity ?? 1000,
    minimumHoursUntilClose: input.minimumHoursUntilClose ?? 168,
    oneSidedPriceThreshold: input.oneSidedPriceThreshold ?? 0.8,
  });

  if (screeningResult.kind === "screening_outcome") {
    return {
      kind: "screening_outcome",
      outcome: screeningResult.screeningOutcome,
    };
  }

  const tavilyResult = await confirmScreenedMarketsWithTavily({
    candidateMarketScreeningResult: screeningResult.candidateMarketScreeningResult,
    now: input.now,
    createDecisionRunId: input.createDecisionRunId,
    queryTavily: input.queryTavily,
  });

  if (tavilyResult.kind === "screening_outcome") {
    return {
      kind: "screening_outcome",
      outcome: tavilyResult.screeningOutcome,
    };
  }

  const frozen = freezeEvidenceSnapshot({
    topic: intake.topic,
    highConvictionMarketsConfirmed: tavilyResult,
    now: input.now,
    createEvidenceSnapshotId: input.createEvidenceSnapshotId,
    createDecisionDossierDraftId: input.createDossierId,
  });

  const marketStructureDraft = await input.generateMarketStructureDraft(
    frozen.evidenceSnapshot,
  );
  const marketStructureRecommendation = adaptMarketStructureDraft({
    evidenceSnapshot: frozen.evidenceSnapshot,
    draft: marketStructureDraft,
    now: input.now,
    createRecommendationId: input.createMarketStructureRecommendationId,
    createWalletActionProposalId: input.createWalletActionProposalId,
    smallStakeAmount: input.smallStakeAmount,
  });

  const externalRiskDraft = await input.generateExternalRiskDraft(
    frozen.evidenceSnapshot,
  );
  const externalRiskRecommendation = adaptExternalRiskDraft({
    evidenceSnapshot: frozen.evidenceSnapshot,
    draft: externalRiskDraft,
    now: input.now,
    createRecommendationId: input.createExternalRiskRecommendationId,
    createWalletActionProposalId: input.createWalletActionProposalId,
    smallStakeAmount: input.smallStakeAmount,
  });

  const agentRecommendations: readonly AgentRecommendation[] = [
    marketStructureRecommendation,
    externalRiskRecommendation,
  ];

  const finalDecision = selectFinalDecision({
    evidenceSnapshot: frozen.evidenceSnapshot,
    agentRecommendations,
    vetoConditions: input.vetoConditions,
    now: input.now,
    createFinalDecisionId: input.createFinalDecisionId,
  });

  const dossierWithRecommendations = {
    ...frozen.decisionDossierDraft,
    agentRecommendations,
    timeline: appendTimelineEntry({
      timeline: frozen.decisionDossierDraft.timeline,
      state: "agent_recommendations_created",
      at: input.now,
      refs: agentRecommendations.map((rec) => rec.id),
    }),
  };

  const dossierWithFinalDecision: DecisionDossier = {
    ...dossierWithRecommendations,
    decisionRun: {
      ...dossierWithRecommendations.decisionRun,
      status: "FINAL_DECISION_SELECTED",
    },
    finalDecision,
    auditAnchors: [],
    timeline: appendTimelineEntry({
      timeline: dossierWithRecommendations.timeline,
      state: "final_decision_selected",
      at: input.now,
      refs: [finalDecision.id],
    }),
  };

  const auditPayload = createDecisionDossierAuditPayload(dossierWithFinalDecision);
  const anchorRequest = createAuditAnchorRequest({
    auditPayload,
    network: "testnet",
  });

  const anchorResult = recordAuditAnchorMetadata({
    decisionDossier: dossierWithFinalDecision,
    anchorRequest,
    chainMetadata: { network: "testnet" },
    now: input.now,
    createAuditAnchorId: input.createAuditAnchorId,
  });

  let dossier = anchorResult.decisionDossier;

  if (
    finalDecision.action !== "HOLD" &&
    input.approvedBy !== undefined
  ) {
    const approvalResult = recordUserApproval({
      decisionDossier: dossier,
      approvedBy: input.approvedBy,
      now: input.now,
      createUserApprovalId: input.createUserApprovalId,
      createExecutionRecordId: input.createExecutionRecordId,
    });
    dossier = approvalResult.decisionDossier;
  }

  return {
    kind: "decision_run_complete",
    dossier,
  };
}
