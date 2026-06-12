import { runSepoliaCalldataAnchor, type SepoliaAnchorMode } from "../src/sepolia-calldata-anchor.js";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const hash = parseFlag(args, "--hash");
  const mode: SepoliaAnchorMode = args.includes("--send") ? "send" : "dry-run";

  const result = await runSepoliaCalldataAnchor({
    mode,
    hash,
  });

  console.log(JSON.stringify({
    kind: "sepolia_calldata_audit_anchor",
    ...result,
  }, null, 2));
}

function parseFlag(args: readonly string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  if (index === -1) {
    return undefined;
  }

  return args[index + 1];
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Sepolia anchor demo failed.");
  process.exitCode = 1;
});
