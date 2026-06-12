import assert from "node:assert/strict";
import test from "node:test";

import {
  confirmScreenedMarketsWithTavily,
  type CandidateMarket,
  type CandidateMarketScreeningResult,
} from "../src/index.js";
import { timelineEntries, timelineStates } from "./helpers.js";

const candidateMarket: CandidateMarket = {
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
    rationale: "YES price is strongly one-sided.",
  },
  screeningRationale: "Polymarket-only hard gates passed.",
};

const noCandidateMarkets: CandidateMarketScreeningResult = {
  kind: "candidate_markets_screened",
  topicId: "topic_fed_rates",
  screenedAt: "2026-06-10T00:02:00.000Z",
  candidateMarkets: [],
  rejectedMarkets: [],
  timeline: timelineEntries([
    "topic_received",
    "markets_fetched",
    "candidate_markets_screened",
  ]),
};

const candidateMarketScreeningResult: CandidateMarketScreeningResult = {
  ...noCandidateMarkets,
  candidateMarkets: [candidateMarket],
};

const blockedCandidateMarket: CandidateMarket = {
  ...candidateMarket,
  id: "candidate_poly_2",
  sourceMarketId: "poly_2",
  question: "Will the Fed hold rates in September?",
};

test("Tavily is not called when Polymarket-only screening found no Candidate Markets", async () => {
  let tavilyCalls = 0;

  const result = await confirmScreenedMarketsWithTavily({
    candidateMarketScreeningResult: noCandidateMarkets,
    now: "2026-06-10T00:03:00.000Z",
    createDecisionRunId: () => "run_1",
    queryTavily: async () => {
      tavilyCalls += 1;
      return [];
    },
  });

  assert.equal(tavilyCalls, 0);
  assert.equal(result.kind, "screening_outcome");
  assert.equal(result.decisionRun, undefined);
  assert.deepEqual(result.screeningOutcome, {
    kind: "screening_outcome",
    topicId: "topic_fed_rates",
    status: "NO_SCREENED_MARKETS",
    reason: "No Candidate Markets were available for Tavily confirmation.",
    rejectedMarketCount: 0,
    createdAt: "2026-06-10T00:03:00.000Z",
  });
});

test("Tavily context confirms Candidate Markets into Screened Markets and creates a Decision Run", async () => {
  const queriedMarketIds: string[] = [];

  const result = await confirmScreenedMarketsWithTavily({
    candidateMarketScreeningResult,
    now: "2026-06-10T00:03:00.000Z",
    createDecisionRunId: () => "run_1",
    queryTavily: async (market) => {
      queriedMarketIds.push(market.id);
      return [
        {
          url: "https://example.com/fed-context",
          title: "Fed rate context",
          summary: "Recent public statements do not show a major reversal risk.",
        },
      ];
    },
  });

  assert.deepEqual(queriedMarketIds, ["candidate_poly_1"]);
  assert.equal(result.kind, "high_conviction_markets_confirmed");
  assert.deepEqual(timelineStates(result.timeline), [
    "topic_received",
    "markets_fetched",
    "candidate_markets_screened",
    "high_conviction_markets_confirmed",
  ]);
  assert.deepEqual(result.contextEvidenceItems, [
    {
      id: "context_candidate_poly_1_1",
      marketId: "candidate_poly_1",
      sourceUrl: "https://example.com/fed-context",
      title: "Fed rate context",
      summary: "Recent public statements do not show a major reversal risk.",
      retrievedAt: "2026-06-10T00:03:00.000Z",
    },
  ]);
  assert.deepEqual(result.screenedMarkets, [
    {
      id: "screened_candidate_poly_1",
      sourceCandidateMarketId: "candidate_poly_1",
      polymarketId: "poly_1",
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
        rationale: "YES price is strongly one-sided.",
      },
      confirmationRationale: "Tavily context found no major counterevidence.",
    },
  ]);
  assert.deepEqual(result.decisionRun, {
    kind: "decision_run",
    id: "run_1",
    topicId: "topic_fed_rates",
    screenedMarketIds: ["screened_candidate_poly_1"],
    status: "CREATED",
    createdAt: "2026-06-10T00:03:00.000Z",
  });
});

test("major Tavily counterevidence blocks promotion to Screened Market", async () => {
  const result = await confirmScreenedMarketsWithTavily({
    candidateMarketScreeningResult,
    now: "2026-06-10T00:03:00.000Z",
    createDecisionRunId: () => "run_1",
    queryTavily: async () => [
      {
        url: "https://example.com/reversal-risk",
        title: "Unexpected reversal risk",
        summary: "A major new signal contradicts the one-sided market view.",
        majorCounterevidence: true,
      },
    ],
  });

  assert.equal(result.kind, "screening_outcome");
  assert.equal(result.decisionRun, undefined);
  assert.deepEqual(result.contextEvidenceItems, [
    {
      id: "context_candidate_poly_1_1",
      marketId: "candidate_poly_1",
      sourceUrl: "https://example.com/reversal-risk",
      title: "Unexpected reversal risk",
      summary: "A major new signal contradicts the one-sided market view.",
      retrievedAt: "2026-06-10T00:03:00.000Z",
    },
  ]);
  assert.deepEqual(result.screeningOutcome, {
    kind: "screening_outcome",
    topicId: "topic_fed_rates",
    status: "NO_SCREENED_MARKETS",
    reason: "Tavily context found major counterevidence or reversal risk.",
    rejectedMarketCount: 1,
    createdAt: "2026-06-10T00:03:00.000Z",
  });
});

test("mixed Tavily confirmation promotes clean Candidate Markets while preserving blocked market evidence", async () => {
  const result = await confirmScreenedMarketsWithTavily({
    candidateMarketScreeningResult: {
      ...candidateMarketScreeningResult,
      candidateMarkets: [candidateMarket, blockedCandidateMarket],
    },
    now: "2026-06-10T00:03:00.000Z",
    createDecisionRunId: () => "run_1",
    queryTavily: async (market) => {
      if (market.id === "candidate_poly_2") {
        return [
          {
            url: "https://example.com/hold-reversal-risk",
            title: "Hold rate reversal risk",
            summary: "A major new signal contradicts the hold-rate market view.",
            majorCounterevidence: true,
          },
        ];
      }

      return [
        {
          url: "https://example.com/fed-context",
          title: "Fed rate context",
          summary: "Recent public statements do not show a major reversal risk.",
        },
      ];
    },
  });

  assert.equal(result.kind, "high_conviction_markets_confirmed");
  assert.deepEqual(
    result.screenedMarkets.map((market) => market.id),
    ["screened_candidate_poly_1"],
  );
  assert.deepEqual(result.decisionRun.screenedMarketIds, [
    "screened_candidate_poly_1",
  ]);
  assert.deepEqual(
    result.contextEvidenceItems.map((item) => ({
      marketId: item.marketId,
      sourceUrl: item.sourceUrl,
    })),
    [
      {
        marketId: "candidate_poly_1",
        sourceUrl: "https://example.com/fed-context",
      },
      {
        marketId: "candidate_poly_2",
        sourceUrl: "https://example.com/hold-reversal-risk",
      },
    ],
  );
});
