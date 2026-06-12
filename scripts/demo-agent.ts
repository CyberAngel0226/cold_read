import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import {
  formatLongHorizonAgentFailure,
  runLongHorizonAgentCli,
  runLongHorizonAuditAgent,
  type LongHorizonAgentProgressStep,
  type LongHorizonAgentRunRecord,
  type LongHorizonAgentStep,
} from "../src/long-horizon-agent.js";

const latestRecordPath = "demo/agent-run-record.latest.json";
const iceBlue = process.stdout.isTTY === true ? "\x1b[96m" : "";
const resetColor = process.stdout.isTTY === true ? "\x1b[0m" : "";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes("--pretty")) {
    const result = await runPrettyAgent(args);
    process.exitCode = result;
    return;
  }

  const result = await runLongHorizonAgentCli({
    args,
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

async function runPrettyAgent(args: readonly string[]): Promise<number> {
  const market = parseFlag(args, "--market");
  const requireLive = args.includes("--require-live");
  const sendAnchor = args.includes("--send-anchor");
  const noWait = args.includes("--no-wait");

  if (market === undefined || market.trim() === "" || market.startsWith("--")) {
    process.stdout.write(formatLongHorizonAgentFailure({
      reason: "--market is required",
      waitForEnter: false,
    }));
    return 1;
  }

  printIntro({
    market,
    requireLive,
    sendAnchor,
  });

  let spinner: Spinner | undefined;
  const result = await runLongHorizonAuditAgent({
    market,
    env: process.env,
    requireLive,
    sendAnchor,
    onProgress: (event) => {
      if (event.kind === "step_started") {
        spinner?.stop();
        spinner = startSpinner(event.step);
        return;
      }

      spinner?.succeed(event.step);
      spinner = undefined;
    },
  });
  spinner?.stop();

  if (result.kind === "agent_run_failed") {
    const waitForEnter = process.stdin.isTTY === true && !noWait;
    process.stdout.write(formatLongHorizonAgentFailure({
      reason: result.reason,
      waitForEnter,
    }));
    if (waitForEnter) {
      await waitForEnterInput();
    }
    return 1;
  }

  try {
    await writeLatestRecord(result.record);
  } catch {
    process.stdout.write(formatLongHorizonAgentFailure({
      reason: "failed to write Agent Run Record",
      waitForEnter: false,
    }));
    return 1;
  }

  printDeliverable(result.record);
  return 0;
}

async function writeLatestRecord(record: LongHorizonAgentRunRecord): Promise<void> {
  await mkdir(dirname(latestRecordPath), { recursive: true });
  await writeFile(latestRecordPath, `${JSON.stringify(record, null, 2)}\n`, "utf8");
}

function printIntro(input: {
  market: string;
  requireLive: boolean;
  sendAnchor: boolean;
}): void {
  const coldReadLogo = [
    "   ██████╗ ██████╗ ██╗     ██████╗ ██████╗ ███████╗ █████╗ ██████╗",
    "  ██╔════╝██╔═══██╗██║     ██╔══██╗██╔══██╗██╔════╝██╔══██╗██╔══██╗",
    "  ██║     ██║   ██║██║     ██║  ██║██████╔╝█████╗  ███████║██║  ██║",
    "  ██║     ██║   ██║██║     ██║  ██║██╔══██╗██╔══╝  ██╔══██║██║  ██║",
    "  ╚██████╗╚██████╔╝███████╗██████╔╝██║  ██║███████╗██║  ██║██████╔╝",
    "   ╚═════╝ ╚═════╝ ╚══════╝╚═════╝ ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝",
  ].join("\n");

  process.stdout.write([
    "",
    `${iceBlue}${coldReadLogo}${resetColor}`,
    "",
    "🧊 ColdRead GLM-5.1 长程审计 Agent / Long-Horizon Audit Agent",
    "任务 / Task: 自主计划 → 工具调用 → 校验修复 → 链上锚点准备",
    `市场 / Market: ${input.market}`,
    `实时模式 / Require Live: ${input.requireLive ? "YES" : "NO"}`,
    `真实上链 / Send Anchor: ${input.sendAnchor ? "YES" : "NO"}`,
    "",
  ].join("\n"));
}

function printDeliverable(record: LongHorizonAgentRunRecord): void {
  process.stdout.write([
    "",
    "最终交付 / Deliverable",
    `引擎 / Engine: GLM-5.1 ${record.mode === "live" ? "live" : "cached replay"}`,
    ...(record.fallbackReason === undefined
      ? []
      : [`回退原因 / Fallback Reason: ${record.fallbackReason}`]),
    `轨迹哈希 / Trace Hash: ${record.traceHash}`,
    `目标地址 / To: ${record.anchor.to}`,
    `调用数据 / Calldata: ${record.anchor.calldata}`,
    `浏览器 / Explorer: ${record.anchor.explorerLink}`,
    `智能体运行记录 / Agent Run Record: ${latestRecordPath}`,
    "",
  ].join("\n"));
}

function startSpinner(step: LongHorizonAgentProgressStep): Spinner {
  const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  let frameIndex = 0;
  const label = `Step ${step.index} ${step.titleZh} / ${step.titleEn}`;
  process.stdout.write(`${frames[frameIndex]} ${label} ...`);
  const timer = setInterval(() => {
    frameIndex = (frameIndex + 1) % frames.length;
    process.stdout.write(`\r${frames[frameIndex]} ${label} ...`);
  }, 100);

  return {
    stop: () => {
      clearInterval(timer);
      process.stdout.write("\r");
    },
    succeed: (completedStep: LongHorizonAgentStep) => {
      clearInterval(timer);
      const marker = completedStep.status === "failed" ? "⚠️" : "✅";
      process.stdout.write(`\r${marker} Step ${completedStep.index} ${completedStep.titleZh} / ${completedStep.titleEn}\n`);
      process.stdout.write(`   工具 / Tool: ${completedStep.toolCall?.name ?? "none"}\n`);
      process.stdout.write(`   观察 / Observation: ${completedStep.observation}\n`);
    },
  };
}

function parseFlag(args: readonly string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  if (index === -1) {
    return undefined;
  }

  return args[index + 1];
}

async function waitForEnterInput(): Promise<void> {
  await new Promise<void>((resolve) => {
    process.stdin.once("data", () => resolve());
  });
}

type Spinner = {
  stop: () => void;
  succeed: (step: LongHorizonAgentStep) => void;
};

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Long-horizon agent demo failed.");
  process.exitCode = 1;
});
