import { fetchLivePolymarketMarketEvidence } from "../src/live-polymarket-market.js";

async function main(): Promise<void> {
  const market = parseMarketArg(process.argv.slice(2));

  if (market === undefined) {
    console.error("Usage: npm run demo:live -- --market <polymarket-market-slug-or-id>");
    process.exitCode = 1;
    return;
  }

  const result = await fetchLivePolymarketMarketEvidence({ market });

  if (result.kind !== "market_found") {
    console.error(result.message);
    process.exitCode = 1;
    return;
  }

  console.log(JSON.stringify({
    kind: "live_polymarket_market_evidence",
    evidence: result.evidence,
  }, null, 2));
}

function parseMarketArg(args: readonly string[]): string | undefined {
  const marketFlagIndex = args.indexOf("--market");
  if (marketFlagIndex === -1) {
    return undefined;
  }

  return args[marketFlagIndex + 1];
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Live demo failed.");
  process.exitCode = 1;
});
