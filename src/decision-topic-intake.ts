import type {
  DecisionTimelineState,
  DecisionTopic,
  IsoTimestamp,
  ScreeningOutcome,
} from "./domain.js";

export type CreateDecisionTopicIntakeInput = {
  text: string;
  submittedBy?: string;
  now: IsoTimestamp;
};

export type DecisionTopicIntake = {
  topic: DecisionTopic;
  timeline: readonly DecisionTimelineState[];
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
  timeline: readonly DecisionTimelineState[];
};

export function createDecisionTopicIntake(
  input: CreateDecisionTopicIntakeInput,
): DecisionTopicIntake {
  return {
    topic: {
      id: "topic_1",
      text: input.text,
      submittedBy: input.submittedBy,
      receivedAt: input.now,
    },
    timeline: ["topic_received"],
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
    timeline: [
      ...input.intake.timeline,
      "markets_fetched",
      "candidate_markets_screened",
    ],
  };
}
