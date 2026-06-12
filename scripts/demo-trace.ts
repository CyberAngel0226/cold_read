import { generateOrLoadAgentRunTrace } from "../src/agent-run-trace.js";
import { fetchLivePolymarketMarketEvidence } from "../src/live-polymarket-market.js";

async function main(): Promise<void> {
  const market = parseMarketArg(process.argv.slice(2));

  if (market === undefined) {
    console.error("Usage: npm run demo:trace -- --market <polymarket-market-slug-or-id>");
    process.exitCode = 1;
    return;
  }

  const marketResult = await fetchLivePolymarketMarketEvidence({ market });
  if (marketResult.kind !== "market_found") {
    console.error(marketResult.message);
    process.exitCode = 1;
    return;
  }

  const traceResult = await generateOrLoadAgentRunTrace({
    marketEvidence: marketResult.evidence,
  });

  console.log(JSON.stringify({
    kind: "glm_agent_run_trace",
    marketEvidence: marketResult.evidence,
    traceSource: traceResult.source,
    fallbackReason: traceResult.fallbackReason,
    trace: traceResult.trace,
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
  console.error(error instanceof Error ? error.message : "Agent trace demo failed.");
  process.exitCode = 1;
});
