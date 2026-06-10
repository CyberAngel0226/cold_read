import assert from "node:assert/strict";
import test from "node:test";

import {
  createDecisionTopicIntake,
  screenCandidateMarkets,
  screenCandidateMarketsForTopic,
  type FetchedPolymarketMarket,
  type MarketRejectionReason,
} from "../src/index.js";

const validMarket: FetchedPolymarketMarket = {
  id: "poly_1",
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
  resolutionRules: "Resolves YES if the Fed cuts rates in July.",
  raw: {},
};

test("active Yes/No market with clear rules, liquidity, runway, and one-sided price becomes a Candidate Market", () => {
  const intake = createDecisionTopicIntake({
    id: "topic_fed_rates",
    text: "Fed rate cut",
    now: "2026-06-10T00:00:00.000Z",
  });

  const result = screenCandidateMarkets({
    topicId: intake.topic.id,
    timeline: [...intake.timeline, "markets_fetched"],
    markets: [validMarket],
    now: "2026-06-10T00:02:00.000Z",
    minimumLiquidity: 1000,
    minimumHoursUntilClose: 24,
    oneSidedPriceThreshold: 0.85,
  });

  assert.deepEqual(result.timeline, [
    "topic_received",
    "markets_fetched",
    "candidate_markets_screened",
  ]);
  assert.equal(result.candidateMarkets.length, 1);
  assert.equal(result.rejectedMarkets.length, 0);
  assert.deepEqual(result.candidateMarkets[0], {
    id: "candidate_poly_1",
    sourceMarketId: "poly_1",
    question: "Will the Fed cut rates in July?",
    outcomes: ["YES", "NO"],
    prices: {
      yes: 0.92,
      no: 0.08,
    },
    volume: 100000,
    liquidity: 25000,
    closeTime: "2026-07-10T00:00:00.000Z",
    resolutionRules: "Resolves YES if the Fed cuts rates in July.",
    oneSidedSignal: {
      side: "YES",
      price: 0.92,
      rationale: "YES price 0.92 meets one-sided threshold 0.85.",
    },
    screeningRationale: "Polymarket-only hard gates passed.",
  });
});

test("NO side exact threshold creates a symmetric One-Sided Signal", () => {
  const result = screenCandidateMarkets({
    topicId: "topic_fed_rates",
    timeline: ["topic_received", "markets_fetched"],
    markets: [
      {
        ...validMarket,
        id: "poly_no_boundary",
        prices: {
          YES: 0.15,
          NO: 0.85,
        },
      },
    ],
    now: "2026-06-10T00:02:00.000Z",
    minimumLiquidity: 1000,
    minimumHoursUntilClose: 24,
    oneSidedPriceThreshold: 0.85,
  });

  assert.equal(result.rejectedMarkets.length, 0);
  assert.deepEqual(result.candidateMarkets[0]?.oneSidedSignal, {
    side: "NO",
    price: 0.85,
    rationale: "NO price 0.85 meets one-sided threshold 0.85.",
  });
});

test("closed or paused markets are rejected before they become Candidate Markets", () => {
  const result = screenCandidateMarkets({
    topicId: "topic_fed_rates",
    timeline: ["topic_received", "markets_fetched"],
    markets: [
      {
        id: "poly_closed",
        question: "Will the Fed cut rates in July?",
        outcomes: ["YES", "NO"],
        prices: {
          YES: 0.92,
          NO: 0.08,
        },
        status: "closed",
        volume: 100000,
        liquidity: 25000,
        closeTime: "2026-07-10T00:00:00.000Z",
        resolutionRules: "Resolves YES if the Fed cuts rates in July.",
        raw: {},
      },
      {
        id: "poly_paused",
        question: "Will the Fed cut rates in September?",
        outcomes: ["YES", "NO"],
        prices: {
          YES: 0.9,
          NO: 0.1,
        },
        status: "paused",
        volume: 100000,
        liquidity: 25000,
        closeTime: "2026-09-10T00:00:00.000Z",
        resolutionRules: "Resolves YES if the Fed cuts rates in September.",
        raw: {},
      },
    ],
    now: "2026-06-10T00:02:00.000Z",
    minimumLiquidity: 1000,
    minimumHoursUntilClose: 24,
    oneSidedPriceThreshold: 0.85,
  });

  assert.deepEqual(result.candidateMarkets, []);
  assert.deepEqual(
    result.rejectedMarkets.map((rejection) => ({
      sourceMarketId: rejection.sourceMarketId,
      reason: rejection.reason,
      rejectedAt: rejection.rejectedAt,
    })),
    [
      {
        sourceMarketId: "poly_closed",
        reason: "CLOSED_OR_PAUSED",
        rejectedAt: "2026-06-10T00:02:00.000Z",
      },
      {
        sourceMarketId: "poly_paused",
        reason: "CLOSED_OR_PAUSED",
        rejectedAt: "2026-06-10T00:02:00.000Z",
      },
    ],
  );
});

test("Polymarket-only hard gates reject markets before Candidate Market creation", () => {
  const cases: Array<{
    name: string;
    market: FetchedPolymarketMarket;
    reason: MarketRejectionReason;
  }> = [
    {
      name: "ambiguous outcomes",
      market: {
        ...validMarket,
        id: "poly_ambiguous_outcomes",
        outcomes: ["UP", "DOWN"],
      },
      reason: "NON_YES_NO_OUTCOMES",
    },
    {
      name: "missing resolution rules",
      market: {
        ...validMarket,
        id: "poly_missing_rules",
        resolutionRules: undefined,
      },
      reason: "UNCLEAR_RESOLUTION_RULES",
    },
    {
      name: "low liquidity",
      market: {
        ...validMarket,
        id: "poly_low_liquidity",
        liquidity: 999,
      },
      reason: "LOW_LIQUIDITY",
    },
    {
      name: "too near resolution",
      market: {
        ...validMarket,
        id: "poly_near_resolution",
        closeTime: "2026-06-10T12:00:00.000Z",
      },
      reason: "TOO_NEAR_RESOLUTION",
    },
    {
      name: "complex multi-result market",
      market: {
        ...validMarket,
        id: "poly_multi_result",
        outcomes: ["YES", "NO", "OTHER"],
      },
      reason: "COMPLEX_MULTI_RESULT_MARKET",
    },
    {
      name: "no one-sided signal",
      market: {
        ...validMarket,
        id: "poly_no_signal",
        prices: {
          YES: 0.55,
          NO: 0.45,
        },
      },
      reason: "NO_ONE_SIDED_SIGNAL",
    },
    {
      name: "specialized knowledge required",
      market: {
        ...validMarket,
        id: "poly_specialized",
        raw: {
          specializedKnowledgeRequired: true,
        },
      },
      reason: "SPECIALIZED_KNOWLEDGE_REQUIRED",
    },
  ];

  for (const { name, market, reason } of cases) {
    const result = screenCandidateMarkets({
      topicId: "topic_fed_rates",
      timeline: ["topic_received", "markets_fetched"],
      markets: [market],
      now: "2026-06-10T00:02:00.000Z",
      minimumLiquidity: 1000,
      minimumHoursUntilClose: 24,
      oneSidedPriceThreshold: 0.85,
    });

    assert.equal(result.candidateMarkets.length, 0, name);
    assert.equal(result.rejectedMarkets.length, 1, name);
    assert.equal(result.rejectedMarkets[0]?.reason, reason, name);
  }
});

test("all rejected Candidate Markets return a Screening Outcome without a Decision Run", () => {
  const intake = createDecisionTopicIntake({
    id: "topic_low_liquidity",
    text: "Low liquidity topic",
    now: "2026-06-10T00:00:00.000Z",
  });

  const result = screenCandidateMarketsForTopic({
    intake,
    markets: [
      {
        ...validMarket,
        id: "poly_low_liquidity",
        liquidity: 500,
      },
    ],
    now: "2026-06-10T00:02:00.000Z",
    minimumLiquidity: 1000,
    minimumHoursUntilClose: 24,
    oneSidedPriceThreshold: 0.85,
  });

  assert.equal(result.kind, "screening_outcome");
  assert.equal(result.decisionRun, undefined);
  assert.deepEqual(result.screeningOutcome, {
    kind: "screening_outcome",
    topicId: "topic_low_liquidity",
    status: "NO_SCREENED_MARKETS",
    reason: "No Candidate Markets passed the Polymarket-only hard gates.",
    rejectedMarketCount: 1,
    createdAt: "2026-06-10T00:02:00.000Z",
  });
  assert.deepEqual(result.timeline, [
    "topic_received",
    "markets_fetched",
    "candidate_markets_screened",
  ]);
});
