# Keep Polymarket Material Outside Domain Market Decisions

`FetchedPolymarketMarket` is external market material, not a ColdRead domain decision object. It preserves Polymarket identifiers, prices, status, liquidity, close time, rules text, and raw payload for inspection and later screening.

The Market Screener is the only boundary that may transform fetched Polymarket material into a `CandidateMarket` or `MarketRejection`. A `CandidateMarket` is still only a Polymarket-only screening result; Tavily-backed confirmation is required before anything becomes a `ScreenedMarket` / High-Conviction Market.

This keeps the domain flow explicit:

```text
FetchedPolymarketMarket[]
  -> Market Screener
  -> CandidateMarket[] + MarketRejection[]
  -> Tavily-backed confirmation
  -> ScreenedMarket[]
```

Analysis Agents and the Decision Scorer must not consume raw fetched Polymarket material as if it were screened evidence. They should consume `EvidenceSnapshot` material created after screening and context confirmation.
