import type {
  DecisionTimelineEntry,
  DecisionTopic,
  IsoTimestamp,
  ScreeningOutcome,
} from "./domain.js";
import {
  appendTimelineEntry,
  createTimelineEntry,
} from "./decision-timeline.js";

export type CreateDecisionTopicIntakeInput = {
  id: string;
  text: string;
  submittedBy?: string;
  now: IsoTimestamp;
};

export type DecisionTopicIntake = {
  topic: DecisionTopic;
  timeline: readonly DecisionTimelineEntry[];
};

export type CreateNoScreenedMarketResultInput = {
  intake: DecisionTopicIntake;
  rejectedMarketCount: number;
  reason: string;
  now: IsoTimestamp;
};

export type NoScreenedMarketResult = {
  topic: DecisionTopic;
  screeningOutcome: ScreeningOutcome;
  decisionRun: undefined;
  timeline: readonly DecisionTimelineEntry[];
};

export function createDecisionTopicIntake(
  input: CreateDecisionTopicIntakeInput,
): DecisionTopicIntake {
  return {
    topic: {
      id: input.id,
      text: input.text,
      submittedBy: input.submittedBy,
      receivedAt: input.now,
    },
    timeline: [
      createTimelineEntry("topic_received", input.now, {
        refs: [input.id],
      }),
    ],
  };
}

export function createNoScreenedMarketResult(
  input: CreateNoScreenedMarketResultInput,
): NoScreenedMarketResult {
  return {
    topic: input.intake.topic,
    screeningOutcome: {
      kind: "screening_outcome",
      topicId: input.intake.topic.id,
      status: "NO_SCREENED_MARKETS",
      reason: input.reason,
      rejectedMarketCount: input.rejectedMarketCount,
      createdAt: input.now,
    },
    decisionRun: undefined,
    timeline: appendTimelineEntry({
      timeline: appendTimelineEntry({
        timeline: input.intake.timeline,
        state: "markets_fetched",
        at: input.now,
      }),
      state: "candidate_markets_screened",
      at: input.now,
      summary: input.reason,
    }),
  };
}
