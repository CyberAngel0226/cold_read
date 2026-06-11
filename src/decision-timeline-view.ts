import type {
  DecisionDossier,
  DecisionTimelineEntry,
  DecisionTimelineState,
  DecisionTopic,
  ExecutionRecord,
  FinalDecision,
  ScreeningOutcome,
  UserApproval,
} from "./domain.js";
import { getUserApprovalView, type UserApprovalView } from "./user-approval.js";

export type DecisionTimelineStepStatus = "complete" | "pending";

export type DecisionTimelineStepView = {
  state: DecisionTimelineState;
  title: string;
  status: DecisionTimelineStepStatus;
  at?: string;
  summary?: string;
  refs: readonly string[];
};

export type DecisionTimelineView = {
  kind: "decision_timeline";
  topic: DecisionTopic;
  decisionRunId: string;
  timeline: readonly DecisionTimelineEntry[];
  steps: readonly DecisionTimelineStepView[];
  finalDecision: FinalDecision;
  approval: UserApprovalView;
  auditAnchors: DecisionDossier["auditAnchors"];
  userApproval?: UserApproval;
  executionRecord?: ExecutionRecord;
  mvpDisclosure: string;
};

export type ScreeningOutcomeTimelineView = {
  kind: "screening_outcome";
  topic: DecisionTopic;
  screeningOutcome: ScreeningOutcome;
  decisionRun: undefined;
  timeline: readonly DecisionTimelineEntry[];
  steps: readonly DecisionTimelineStepView[];
};

export type RenderScreeningOutcomeTimelineInput = {
  topic: DecisionTopic;
  screeningOutcome: ScreeningOutcome;
  timeline: readonly DecisionTimelineEntry[];
};

const orderedTimelineStates: readonly DecisionTimelineState[] = [
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
];

const timelineTitles: Record<DecisionTimelineState, string> = {
  topic_received: "Topic received",
  markets_fetched: "Markets fetched",
  candidate_markets_screened: "Candidate markets screened",
  high_conviction_markets_confirmed: "High-conviction markets confirmed",
  evidence_snapshot_created: "Evidence snapshot created",
  agent_recommendations_created: "Agent recommendations created",
  final_decision_selected: "Final decision selected",
  audit_anchor_written: "Audit anchor written",
  user_approval_recorded: "User approval recorded",
  execution_record_created: "Execution record created",
};

const mvpDisclosure =
  "MVP records approval and audit metadata; it does not place real prediction market trades.";

export function renderDecisionTimeline(
  decisionDossier: DecisionDossier,
): DecisionTimelineView {
  return {
    kind: "decision_timeline",
    topic: decisionDossier.topic,
    decisionRunId: decisionDossier.decisionRun.id,
    timeline: decisionDossier.timeline,
    steps: renderTimelineSteps(decisionDossier.timeline),
    finalDecision: decisionDossier.finalDecision,
    approval: getUserApprovalView(decisionDossier.finalDecision),
    auditAnchors: decisionDossier.auditAnchors,
    userApproval: decisionDossier.userApproval,
    executionRecord: decisionDossier.executionRecord,
    mvpDisclosure,
  };
}

export function renderScreeningOutcomeTimeline(
  input: RenderScreeningOutcomeTimelineInput,
): ScreeningOutcomeTimelineView {
  const timeline = mergeScreeningOutcomeSummary(input.timeline, input.screeningOutcome);
  return {
    kind: "screening_outcome",
    topic: input.topic,
    screeningOutcome: input.screeningOutcome,
    decisionRun: undefined,
    timeline,
    steps: renderCompletedTimelineSteps(timeline),
  };
}

function renderTimelineSteps(
  timeline: readonly DecisionTimelineEntry[],
): readonly DecisionTimelineStepView[] {
  const entriesByState = new Map<DecisionTimelineState, DecisionTimelineEntry>();
  for (const entry of timeline) {
    entriesByState.set(entry.state, entry);
  }

  return orderedTimelineStates.map((state) => {
    const entry = entriesByState.get(state);
    return {
      state,
      title: timelineTitles[state],
      status: entry === undefined ? "pending" : "complete",
      ...(entry?.at === undefined ? {} : { at: entry.at }),
      ...(entry?.summary === undefined ? {} : { summary: entry.summary }),
      refs: entry?.refs ?? [],
    };
  });
}

function renderCompletedTimelineSteps(
  timeline: readonly DecisionTimelineEntry[],
): readonly DecisionTimelineStepView[] {
  const entriesByState = new Map<DecisionTimelineState, DecisionTimelineEntry>();
  for (const entry of timeline) {
    entriesByState.set(entry.state, entry);
  }

  return orderedTimelineStates.flatMap((state) => {
    const entry = entriesByState.get(state);
    if (entry === undefined) {
      return [];
    }
    return [
      {
        state,
        title: timelineTitles[state],
        status: "complete",
        at: entry.at,
        ...(entry.summary === undefined ? {} : { summary: entry.summary }),
        refs: entry.refs ?? [],
      },
    ];
  });
}

function mergeScreeningOutcomeSummary(
  timeline: readonly DecisionTimelineEntry[],
  screeningOutcome: ScreeningOutcome,
): readonly DecisionTimelineEntry[] {
  return timeline.map((entry) => {
    if (entry.state !== "candidate_markets_screened") {
      return entry;
    }
    return {
      ...entry,
      summary: entry.summary ?? screeningOutcome.reason,
    };
  });
}
