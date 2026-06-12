import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import {
  runLongHorizonAgentCli,
  type LongHorizonAgentRunRecord,
} from "../src/long-horizon-agent.js";

const latestRecordPath = "demo/agent-run-record.latest.json";

async function main(): Promise<void> {
  const result = await runLongHorizonAgentCli({
    args: process.argv.slice(2),
    env: process.env,
    isInteractive: process.stdin.isTTY === true,
    writeLatestRecord: writeLatestRecord,
  });

  if (result.stdout !== "") {
    process.stdout.write(result.stdout);
  }
  if (result.stderr !== "") {
    process.stderr.write(result.stderr);
  }
  process.exitCode = result.exitCode;
}

async function writeLatestRecord(record: LongHorizonAgentRunRecord): Promise<void> {
  await mkdir(dirname(latestRecordPath), { recursive: true });
  await writeFile(latestRecordPath, `${JSON.stringify(record, null, 2)}\n`, "utf8");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Long-horizon agent demo failed.");
  process.exitCode = 1;
});
