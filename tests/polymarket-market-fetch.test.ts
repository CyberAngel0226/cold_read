import assert from "node:assert/strict";
import test from "node:test";

import {
  createDecisionTopicIntake,
  fetchPolymarketMarketsForTopic,
} from "../src/index.js";
import { timelineStates } from "./helpers.js";

test("fetches related Polymarket markets for a Decision Topic and preserves screening fields", async () => {
  const intake = createDecisionTopicIntake({
    id: "topic_fed_rates",
    text: "Fed rate cut",
    submittedBy: "user_1",
    now: "2026-06-10T00:00:00.000Z",
  });

  const requestedUrls: string[] = [];
  const result = await fetchPolymarketMarketsForTopic({
    intake,
    now: "2026-06-10T00:01:00.000Z",
    fetcher: async (url) => {
      requestedUrls.push(url);
      return {
        ok: true,
        status: 200,
        json: async () => [
          {
            id: "123",
            conditionId: "0xabc",
            question: "Will the Fed cut rates in July?",
            outcomes: '["Yes","No"]',
            outcomePrices: '["0.92","0.08"]',
            active: true,
            closed: false,
            volume: "100000",
            liquidity: "25000",
            endDate: "2026-07-10T00:00:00.000Z",
            description: "Resolves Yes if the Fed cuts rates in July.",
          },
        ],
      };
    },
  });

  assert.equal(result.kind, "markets_fetched");
  assert.match(requestedUrls[0] ?? "", /gamma-api\.polymarket\.com\/markets/);
  assert.match(requestedUrls[0] ?? "", /search=Fed\+rate\+cut/);
  assert.deepEqual(timelineStates(result.timeline), [
    "topic_received",
    "markets_fetched",
  ]);
  assert.equal(result.markets.length, 1);
  assert.deepEqual(result.markets[0], {
    id: "123",
    conditionId: "0xabc",
    question: "Will the Fed cut rates in July?",
    outcomes: ["YES", "NO"],
    prices: {
      YES: 0.92,
      NO: 0.08,
    },
    status: "active",
    volume: 100000,
    liquidity: 25000,
    closeTime: "2026-07-10T00:00:00.000Z",
    resolutionRules: "Resolves Yes if the Fed cuts rates in July.",
    raw: {
      id: "123",
      conditionId: "0xabc",
      question: "Will the Fed cut rates in July?",
      outcomes: '["Yes","No"]',
      outcomePrices: '["0.92","0.08"]',
      active: true,
      closed: false,
      volume: "100000",
      liquidity: "25000",
      endDate: "2026-07-10T00:00:00.000Z",
      description: "Resolves Yes if the Fed cuts rates in July.",
    },
  });
});

test("empty Polymarket results still produce a markets_fetched state", async () => {
  const intake = createDecisionTopicIntake({
    id: "topic_no_matching_market",
    text: "No matching market",
    now: "2026-06-10T00:00:00.000Z",
  });

  const result = await fetchPolymarketMarketsForTopic({
    intake,
    now: "2026-06-10T00:01:00.000Z",
    fetcher: async () => ({
      ok: true,
      status: 200,
      json: async () => [],
    }),
  });

  assert.equal(result.kind, "markets_fetched");
  assert.deepEqual(result.markets, []);
  assert.deepEqual(timelineStates(result.timeline), [
    "topic_received",
    "markets_fetched",
  ]);
});

test("failed Polymarket requests produce a recoverable fetch failure", async () => {
  const intake = createDecisionTopicIntake({
    id: "topic_fetch_failure",
    text: "Fed rate cut",
    now: "2026-06-10T00:00:00.000Z",
  });

  const result = await fetchPolymarketMarketsForTopic({
    intake,
    now: "2026-06-10T00:01:00.000Z",
    fetcher: async () => ({
      ok: false,
      status: 503,
      json: async () => ({ message: "unavailable" }),
    }),
  });

  assert.deepEqual(result, {
    kind: "market_fetch_failed",
    topicId: intake.topic.id,
    failedAt: "2026-06-10T00:01:00.000Z",
    status: 503,
    message: "Polymarket request failed with 503.",
    timeline: intake.timeline,
  });
});

test("network errors during Polymarket fetch are recoverable", async () => {
  const intake = createDecisionTopicIntake({
    id: "topic_network_error",
    text: "Fed rate cut",
    now: "2026-06-10T00:00:00.000Z",
  });

  const result = await fetchPolymarketMarketsForTopic({
    intake,
    now: "2026-06-10T00:01:00.000Z",
    fetcher: async () => {
      throw new Error("network timeout");
    },
  });

  assert.deepEqual(result, {
    kind: "market_fetch_failed",
    topicId: intake.topic.id,
    failedAt: "2026-06-10T00:01:00.000Z",
    message: "network timeout",
    timeline: intake.timeline,
  });
});
