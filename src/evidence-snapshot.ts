import type {
  DecisionRun,
  DecisionTimelineEntry,
  DecisionTopic,
  EvidenceSnapshot,
  IsoTimestamp,
} from "./domain.js";
import { appendTimelineEntry } from "./decision-timeline.js";
import type { HighConvictionMarketsConfirmedResult } from "./tavily-market-confirmation.js";

export type DecisionDossierDraft = {
  id: string;
  topic: DecisionTopic;
  decisionRun: DecisionRun;
  evidenceSnapshot: EvidenceSnapshot;
  timeline: readonly DecisionTimelineEntry[];
};

export type FreezeEvidenceSnapshotInput = {
  topic: DecisionTopic;
  highConvictionMarketsConfirmed: HighConvictionMarketsConfirmedResult;
  now: IsoTimestamp;
  createEvidenceSnapshotId: () => string;
  createDecisionDossierDraftId: () => string;
};

export type EvidenceSnapshotFrozenResult = {
  kind: "evidence_snapshot_created";
  decisionRun: DecisionRun;
  evidenceSnapshot: EvidenceSnapshot;
  analysisEvidenceSnapshot: EvidenceSnapshot;
  decisionDossierDraft: DecisionDossierDraft;
  timeline: readonly DecisionTimelineEntry[];
};

export function freezeEvidenceSnapshot(
  input: FreezeEvidenceSnapshotInput,
): EvidenceSnapshotFrozenResult {
  if (input.highConvictionMarketsConfirmed.screenedMarkets.length === 0) {
    throw new Error("Evidence Snapshot requires at least one Screened Market.");
  }

  const decisionRun: DecisionRun = {
    ...input.highConvictionMarketsConfirmed.decisionRun,
    status: "EVIDENCE_SNAPSHOT_CREATED",
  };
  const evidenceSnapshotId = input.createEvidenceSnapshotId();
  const timeline: readonly DecisionTimelineEntry[] = appendTimelineEntry({
    timeline: input.highConvictionMarketsConfirmed.timeline,
    state: "evidence_snapshot_created",
    at: input.now,
    refs: [evidenceSnapshotId],
  });
  const evidenceSnapshot: EvidenceSnapshot = {
    id: evidenceSnapshotId,
    decisionRunId: decisionRun.id,
    createdAt: input.now,
    marketEvidence: {
      screenedMarkets: input.highConvictionMarketsConfirmed.screenedMarkets,
    },
    contextEvidence: {
      items: input.highConvictionMarketsConfirmed.contextEvidenceItems,
    },
  };

  return {
    kind: "evidence_snapshot_created",
    decisionRun,
    evidenceSnapshot,
    analysisEvidenceSnapshot: evidenceSnapshot,
    decisionDossierDraft: {
      id: input.createDecisionDossierDraftId(),
      topic: input.topic,
      decisionRun,
      evidenceSnapshot,
      timeline,
    },
    timeline,
  };
}
