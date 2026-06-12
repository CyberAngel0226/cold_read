import assert from "node:assert/strict";
import test from "node:test";

import {
  createDecisionTopicIntake,
  createNoScreenedMarketResult,
} from "../src/index.js";
import { timelineStates } from "./helpers.js";

test("user can submit a Decision Topic and see topic_received timeline state", () => {
  const intake = createDecisionTopicIntake({
    id: "topic_fed_rates",
    text: "Will the Fed cut rates at the next meeting?",
    submittedBy: "user_1",
    now: "2026-06-10T00:00:00.000Z",
  });

  assert.equal(intake.topic.id, "topic_fed_rates");
  assert.equal(intake.topic.text, "Will the Fed cut rates at the next meeting?");
  assert.equal(intake.topic.submittedBy, "user_1");
  assert.equal(intake.topic.receivedAt, "2026-06-10T00:00:00.000Z");
  assert.deepEqual(intake.timeline, [
    {
      state: "topic_received",
      at: "2026-06-10T00:00:00.000Z",
      refs: ["topic_fed_rates"],
    },
  ]);
});

test("no Screened Market returns Screening Outcome without creating Decision Run", () => {
  const intake = createDecisionTopicIntake({
    id: "topic_no_matching_market",
    text: "Will an obviously unrelated event happen?",
    submittedBy: "user_1",
    now: "2026-06-10T00:00:00.000Z",
  });

  const result = createNoScreenedMarketResult({
    intake,
    rejectedMarketCount: 4,
    reason: "No related markets passed the screener.",
    now: "2026-06-10T00:01:00.000Z",
  });

  assert.equal(result.screeningOutcome.kind, "screening_outcome");
  assert.equal(result.screeningOutcome.status, "NO_SCREENED_MARKETS");
  assert.equal(result.screeningOutcome.topicId, intake.topic.id);
  assert.equal(result.screeningOutcome.rejectedMarketCount, 4);
  assert.equal(result.decisionRun, undefined);
  assert.deepEqual(timelineStates(result.timeline), [
    "topic_received",
    "markets_fetched",
    "candidate_markets_screened",
  ]);
  assert.deepEqual(result.timeline.at(-1), {
    state: "candidate_markets_screened",
    at: "2026-06-10T00:01:00.000Z",
    summary: "No related markets passed the screener.",
  });
});
