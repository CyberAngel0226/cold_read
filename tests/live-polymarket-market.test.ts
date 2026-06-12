import assert from "node:assert/strict";
import test from "node:test";

import {
  fetchLivePolymarketMarketEvidence,
  normalizePolymarketMarketEvidence,
} from "../src/live-polymarket-market.js";

const fedCutMarketPayload = {
  id: "123",
  conditionId: "0xabc",
  slug: "fed-cuts-in-july",
  question: "Will the Fed cut interest rates in July 2026?",
  outcomes: "[\"Yes\",\"No\"]",
  outcomePrices: "[\"0.88\",\"0.12\"]",
  volume: "1200000",
  liquidity: "350000",
  active: true,
  closed: false,
  endDate: "2026-07-10T00:00:00Z",
  description: "Resolves YES if the Federal Reserve announces a rate cut.",
};

test("normalizes a Polymarket market payload into live market evidence", () => {
  const evidence = normalizePolymarketMarketEvidence(fedCutMarketPayload);

  assert.equal(evidence.id, "123");
  assert.equal(evidence.conditionId, "0xabc");
  assert.equal(evidence.slug, "fed-cuts-in-july");
  assert.equal(evidence.question, "Will the Fed cut interest rates in July 2026?");
  assert.deepEqual(evidence.outcomes, ["YES", "NO"]);
  assert.equal(evidence.prices.YES, 0.88);
  assert.equal(evidence.prices.NO, 0.12);
  assert.equal(evidence.volume, 1_200_000);
  assert.equal(evidence.liquidity, 350_000);
  assert.equal(evidence.status, "active");
  assert.equal(evidence.sourceUrl, "https://polymarket.com/event/fed-cuts-in-july");
});

test("fetches live Polymarket evidence by slug or id without a wallet", async () => {
  const requestedUrls: string[] = [];

  const result = await fetchLivePolymarketMarketEvidence({
    market: "fed-cuts-in-july",
    fetcher: async (url) => {
      requestedUrls.push(url);
      return {
        ok: true,
        status: 200,
        json: async () => [fedCutMarketPayload],
      };
    },
  });

  assert.equal(result.kind, "market_found");
  assert.equal(result.evidence.slug, "fed-cuts-in-july");
  assert.equal(result.evidence.sourceApiUrl, requestedUrls[0]);
  assert.match(requestedUrls[0], /gamma-api\.polymarket\.com\/markets/);
  assert.match(requestedUrls[0], /search=fed-cuts-in-july/);
});

test("returns a clear not-found result for an unknown market", async () => {
  const result = await fetchLivePolymarketMarketEvidence({
    market: "missing-market",
    fetcher: async () => ({
      ok: true,
      status: 200,
      json: async () => [],
    }),
  });

  assert.equal(result.kind, "market_not_found");
  assert.match(result.message, /missing-market/);
});

test("does not fall back to the first search result when identifiers do not match", async () => {
  const result = await fetchLivePolymarketMarketEvidence({
    market: "missing-market",
    fetcher: async () => ({
      ok: true,
      status: 200,
      json: async () => [fedCutMarketPayload],
    }),
  });

  assert.equal(result.kind, "market_not_found");
  assert.match(result.message, /missing-market/);
});
