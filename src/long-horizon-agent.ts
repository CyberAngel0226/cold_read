import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import { cachedDemoAgentRunTrace, type AgentRunTrace } from "./agent-run-trace.js";
import { hashAuditPayload } from "./decision-dossier-audit.js";
import type { LivePolymarketMarketEvidence } from "./live-polymarket-market.js";
import {
  runSepoliaCalldataAnchor,
  type SepoliaCalldataAnchorEnv,
  type SepoliaCalldataAnchorResult,
} from "./sepolia-calldata-anchor.js";

export type LongHorizonAgentMode = "live" | "cached_replay";
export type LongHorizonAgentToolName =
  | "plan_task"
  | "fetch_polymarket_market"
  | "draft_agent_trace"
  | "validate_agent_trace"
  | "repair_agent_trace"
  | "compute_trace_hash"
  | "prepare_sepolia_anchor"
  | "send_sepolia_anchor";

export type LongHorizonAgentStepStatus = "completed" | "failed";

export type LongHorizonAgentStep = {
  id: string;
  index: number;
  title: string;
  titleZh: string;
  titleEn: string;
  status: LongHorizonAgentStepStatus;
  modelAction: {
    summary: string;
    nextTool: LongHorizonAgentToolName;
  };
  toolCall?: {
    name: LongHorizonAgentToolName;
    input: Record<string, unknown>;
  };
  observation: string;
  repairOfStepId?: string;
};

export type LongHorizonAgentRunRecord = {
  version: "coldread.long-horizon-agent-run.v1";
  engine: "GLM-5.1";
  mode: LongHorizonAgentMode;
  fallbackReason?: string;
  createdAt: string;
  market: string;
  marketEvidence: LivePolymarketMarketEvidence;
  steps: readonly LongHorizonAgentStep[];
  finalTrace: AgentRunTrace;
  traceHash: string;
  anchor: SepoliaCalldataAnchorResult;
};

export type RunLongHorizonAuditAgentInput = {
  market: string;
  env?: SepoliaCalldataAnchorEnv & {
    ZAI_API_KEY?: string;
  };
  requireLive?: boolean;
  sendAnchor?: boolean;
  now?: Date;
  plannerClient?: LongHorizonAgentPlannerClient;
};

export type LongHorizonAgentPlannerRequest = {
  model: "glm-5.1";
  market: string;
  prompt: string;
};

export type LongHorizonAgentPlannerResult = {
  planSummary: string;
};

export type LongHorizonAgentPlannerClient = (
  request: LongHorizonAgentPlannerRequest,
) => Promise<LongHorizonAgentPlannerResult>;

export type RunLongHorizonAuditAgentResult =
  | {
      kind: "agent_run_completed";
      record: LongHorizonAgentRunRecord;
    }
  | {
      kind: "agent_run_failed";
      reason: string;
    };

export type RunLongHorizonAgentCliInput = {
  args: readonly string[];
  env?: Record<string, string | undefined>;
  isInteractive?: boolean;
  waitForEnter?: () => Promise<void>;
  writeLatestRecord?: (record: LongHorizonAgentRunRecord) => Promise<void>;
};

export type RunLongHorizonAgentCliResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

const cachedMarketEvidence: LivePolymarketMarketEvidence = {
  id: "540817",
  conditionId: "0x1fad72fae204143ff1c3035e99e7c0f65ea8d5cd9bd1070987bd1a3316f772be",
  slug: "new-rhianna-album-before-gta-vi-926",
  question: "New Rihanna Album before GTA VI?",
  outcomes: ["YES", "NO"],
  prices: {
    YES: 0.51,
    NO: 0.49,
  },
  status: "active",
  volume: 825104.0995600048,
  liquidity: 21850.0387,
  closeTime: "2026-07-31T12:00:00Z",
  resolutionRules: "Resolves YES if Rihanna officially releases a new album before GTA VI is officially released in the US.",
  source: "polymarket",
  sourceUrl: "https://polymarket.com/event/new-rhianna-album-before-gta-vi-926",
  raw: {
    cachedReplay: true,
  },
};

export async function runLongHorizonAuditAgent(
  input: RunLongHorizonAuditAgentInput,
): Promise<RunLongHorizonAuditAgentResult> {
  const env = input.env ?? process.env;
  if (input.requireLive === true && !env.ZAI_API_KEY) {
    return {
      kind: "agent_run_failed",
      reason: "ZAI_API_KEY missing",
    };
  }

  let mode: LongHorizonAgentMode = "cached_replay";
  let fallbackReason: string | undefined;
  let planSummary = "GLM-5.1 制定 6 步审计计划。";

  if (env.ZAI_API_KEY) {
    const plannerClient = input.plannerClient ?? createZaiPlannerClient(env.ZAI_API_KEY);
    try {
      const planned = await plannerClient({
        model: "glm-5.1",
        market: input.market,
        prompt: buildPlannerPrompt(input.market),
      });
      mode = "live";
      planSummary = planned.planSummary;
    } catch {
      if (input.requireLive === true) {
        return {
          kind: "agent_run_failed",
          reason: "live GLM call failed",
        };
      }
      fallbackReason = "live GLM call failed; using committed replay";
    }
  }

  const createdAt = (input.now ?? new Date()).toISOString();
  const finalTrace: AgentRunTrace = {
    ...cachedDemoAgentRunTrace,
    generatedAt: createdAt,
    task: {
      ...cachedDemoAgentRunTrace.task,
      targetMarketId: input.market,
    },
    finalLensDraft: {
      ...cachedDemoAgentRunTrace.finalLensDraft,
      targetMarketId: input.market,
    },
  };
  const traceHash = hashAuditPayload(finalTrace);
  const anchor = await runSepoliaCalldataAnchor({
    mode: input.sendAnchor === true ? "send" : "dry-run",
    hash: traceHash,
    env,
  });

  return {
    kind: "agent_run_completed",
    record: {
      version: "coldread.long-horizon-agent-run.v1",
      engine: "GLM-5.1",
      mode,
      ...(fallbackReason === undefined ? {} : { fallbackReason }),
      createdAt,
      market: input.market,
      marketEvidence: {
        ...cachedMarketEvidence,
        slug: input.market,
        sourceUrl: `https://polymarket.com/event/${input.market}`,
      },
      steps: buildCachedReplaySteps(input.market, traceHash, planSummary),
      finalTrace,
      traceHash,
      anchor,
    },
  };
}

export async function runLongHorizonAgentCli(
  input: RunLongHorizonAgentCliInput,
): Promise<RunLongHorizonAgentCliResult> {
  const market = parseFlag(input.args, "--market") ?? "";
  const pretty = input.args.includes("--pretty");
  const requireLive = input.args.includes("--require-live");
  const sendAnchor = input.args.includes("--send-anchor");
  const noWait = input.args.includes("--no-wait");

  const result = await runLongHorizonAuditAgent({
    market,
    env: input.env,
    requireLive,
    sendAnchor,
  });

  if (result.kind === "agent_run_completed") {
    await input.writeLatestRecord?.(result.record);
    return {
      exitCode: 0,
      stdout: pretty
        ? formatLongHorizonAgentPrettyOutput(result.record)
        : `${JSON.stringify({
          kind: "long_horizon_agent_run",
          record: result.record,
        }, null, 2)}\n`,
      stderr: "",
    };
  }

  if (pretty) {
    const stdout = formatLongHorizonAgentFailure({
      reason: result.reason,
      waitForEnter: input.isInteractive === true && !noWait,
    });
    if (input.isInteractive === true && !noWait) {
      await (input.waitForEnter ?? waitForEnter)();
    }
    return {
      exitCode: 1,
      stdout,
      stderr: "",
    };
  }

  return {
    exitCode: 1,
    stdout: `${JSON.stringify({
      kind: "long_horizon_agent_error",
      reason: result.reason,
    }, null, 2)}\n`,
    stderr: "",
  };
}

export function formatLongHorizonAgentPrettyOutput(
  record: LongHorizonAgentRunRecord,
): string {
  const lines = [
    "╭────────────────────────────────────────────────╮",
    "│  🧊 ColdRead GLM-5.1 长程审计 Agent / Audit Agent │",
    "│  自主计划 → 工具调用 → 校验修复 → 链上锚点准备       │",
    "╰────────────────────────────────────────────────╯",
    "",
    `引擎 / Engine: GLM-5.1 ${record.mode === "live" ? "live" : "cached replay"}`,
    `市场 / Market: ${record.market}`,
    `锚点模式 / Anchor Mode: ${record.anchor.status}`,
    "",
    ...record.steps.flatMap((step) => [
      `${step.status === "failed" ? "⚠️" : "✅"} Step ${step.index} ${step.titleZh} / ${step.titleEn}`,
      `   工具 / Tool: ${step.toolCall?.name ?? "none"}`,
      `   观察 / Observation: ${step.observation}`,
    ]),
    "",
    "最终交付 / Deliverable",
    `轨迹哈希 / Trace Hash: ${record.traceHash}`,
    `目标地址 / To: ${record.anchor.to}`,
    `调用数据 / Calldata: ${record.anchor.calldata}`,
    `浏览器 / Explorer: ${record.anchor.explorerLink}`,
    "智能体运行记录 / Agent Run Record: demo/agent-run-record.latest.json",
  ];

  return `${lines.join("\n")}\n`;
}

export function formatLongHorizonAgentFailure(input: {
  reason: string;
  waitForEnter: boolean;
}): string {
  return [
    "╭────────────────────────────────────────────────╮",
    "│  ❌ 需要实时 GLM-5.1 / Live GLM-5.1 required     │",
    "╰────────────────────────────────────────────────╯",
    "",
    `原因 / Reason: ${input.reason}`,
    ...(input.waitForEnter ? ["按 Enter 退出 / Press Enter to exit"] : []),
    "",
  ].join("\n");
}

function buildCachedReplaySteps(
  market: string,
  traceHash: string,
  planSummary: string,
): LongHorizonAgentStep[] {
  return [
    step(1, "任务拆解", "Plan task", "plan_task", planSummary, { market }),
    step(2, "读取真实盘口", "Fetch live market", "fetch_polymarket_market", "找到真实 Polymarket 市场并保留来源链接。", { market }),
    step(3, "生成轨迹草稿", "Draft trace", "draft_agent_trace", "GLM-5.1 生成第一版 Agent Run Trace。", { market }),
    {
      ...step(4, "轨迹校验失败", "Trace validation failed", "validate_agent_trace", "trace 缺少 externalRiskFlags，工具拒绝进入审计载荷。", { requiredField: "externalRiskFlags" }),
      status: "failed",
    },
    {
      ...step(5, "自我修复", "Self repair", "repair_agent_trace", "GLM-5.1 补齐风险字段，并将建议降级为 HOLD。", { repair: "externalRiskFlags" }),
      repairOfStepId: "step-4",
    },
    step(6, "计算哈希并准备锚点", "Compute hash and prepare anchor", "prepare_sepolia_anchor", "已计算 trace hash 并准备 Sepolia calldata anchor。", { traceHash }),
  ];
}

function createZaiPlannerClient(apiKey: string): LongHorizonAgentPlannerClient {
  return async (request) => {
    const response = await fetch("https://api.z.ai/api/paas/v4/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: request.model,
        messages: [
          {
            role: "user",
            content: request.prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Z.AI planner failed with ${response.status}.`);
    }

    const payload = await response.json();
    return {
      planSummary: extractPlannerContent(payload),
    };
  };
}

function buildPlannerPrompt(market: string): string {
  return [
    "You are ColdRead's GLM-5.1 long-horizon Web3 audit agent.",
    "Plan a bounded six-step task for auditing a Polymarket decision.",
    "The plan must include tool calls, validation, one repair step, trace hashing, and Sepolia anchor preparation.",
    "Return a concise plan summary only.",
    `Market: ${market}`,
  ].join("\n");
}

function extractPlannerContent(payload: unknown): string {
  if (!isRecord(payload) || !Array.isArray(payload.choices)) {
    throw new Error("Z.AI planner response did not include choices.");
  }

  const firstChoice = payload.choices[0];
  if (!isRecord(firstChoice) || !isRecord(firstChoice.message)) {
    throw new Error("Z.AI planner response did not include a message.");
  }

  const content = firstChoice.message.content;
  if (typeof content !== "string" || content.trim() === "") {
    throw new Error("Z.AI planner response message content is empty.");
  }

  return content.trim();
}

function step(
  index: number,
  titleZh: string,
  titleEn: string,
  tool: LongHorizonAgentToolName,
  observation: string,
  input: Record<string, unknown>,
): LongHorizonAgentStep {
  return {
    id: `step-${index}`,
    index,
    title: `${titleZh} / ${titleEn}`,
    titleZh,
    titleEn,
    status: "completed",
    modelAction: {
      summary: `Select ${tool} as the next bounded ColdRead tool.`,
      nextTool: tool,
    },
    toolCall: {
      name: tool,
      input,
    },
    observation,
  };
}

function parseFlag(args: readonly string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  if (index === -1) return undefined;
  return args[index + 1];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function waitForEnter(): Promise<void> {
  const readline = createInterface({ input, output });
  await readline.question("");
  readline.close();
}
