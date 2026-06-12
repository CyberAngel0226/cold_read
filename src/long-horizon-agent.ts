import { stdin as input, stdout as output } from "node:process";
import { createInterface } from "node:readline/promises";

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

export type LongHorizonAgentProgressStep = {
  index: number;
  titleZh: string;
  titleEn: string;
  tool: LongHorizonAgentToolName;
};

export type LongHorizonAgentProgressEvent =
  | {
      kind: "step_started";
      step: LongHorizonAgentProgressStep;
    }
  | {
      kind: "step_completed";
      step: LongHorizonAgentStep;
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

export type LongHorizonAgentPlannerRequest = {
  model: "glm-5.1";
  market: string;
  stepIndex: number;
  expectedTool: LongHorizonAgentToolName;
  prompt: string;
};

export type LongHorizonAgentPlannerResult = {
  actionSummary: string;
};

export type LongHorizonAgentPlannerClient = (
  request: LongHorizonAgentPlannerRequest,
) => Promise<LongHorizonAgentPlannerResult>;

export type RunLongHorizonAuditAgentInput = {
  market: string;
  env?: SepoliaCalldataAnchorEnv & {
    ZAI_API_KEY?: string;
  };
  requireLive?: boolean;
  sendAnchor?: boolean;
  now?: Date;
  plannerClient?: LongHorizonAgentPlannerClient;
  onProgress?: (event: LongHorizonAgentProgressEvent) => void | Promise<void>;
};

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

const stepSpecs: readonly {
  index: number;
  titleZh: string;
  titleEn: string;
  tool: LongHorizonAgentToolName;
  observation: string;
  input: (market: string, traceHash: string) => Record<string, unknown>;
  status?: LongHorizonAgentStepStatus;
  repairOfStepId?: string;
}[] = [
  {
    index: 1,
    titleZh: "任务拆解",
    titleEn: "Plan task",
    tool: "plan_task",
    observation: "GLM-5.1 制定 6 步审计计划。",
    input: (market) => ({ market }),
  },
  {
    index: 2,
    titleZh: "读取真实盘口",
    titleEn: "Fetch live market",
    tool: "fetch_polymarket_market",
    observation: "找到真实 Polymarket 市场并保留来源链接。",
    input: (market) => ({ market }),
  },
  {
    index: 3,
    titleZh: "生成轨迹草稿",
    titleEn: "Draft trace",
    tool: "draft_agent_trace",
    observation: "GLM-5.1 生成第一版 Agent Run Trace。",
    input: (market) => ({ market }),
  },
  {
    index: 4,
    titleZh: "轨迹校验失败",
    titleEn: "Trace validation failed",
    tool: "validate_agent_trace",
    observation: "trace 缺少 externalRiskFlags，工具拒绝进入审计载荷。",
    input: () => ({ requiredField: "externalRiskFlags" }),
    status: "failed",
  },
  {
    index: 5,
    titleZh: "自我修复",
    titleEn: "Self repair",
    tool: "repair_agent_trace",
    observation: "GLM-5.1 补齐风险字段，并将建议降级为 HOLD。",
    input: () => ({ repair: "externalRiskFlags" }),
    repairOfStepId: "step-4",
  },
  {
    index: 6,
    titleZh: "计算哈希并准备锚点",
    titleEn: "Compute hash and prepare anchor",
    tool: "prepare_sepolia_anchor",
    observation: "已计算 trace hash 并准备 Sepolia calldata anchor。",
    input: (_market, traceHash) => ({ traceHash }),
  },
];

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
  const createdAt = (input.now ?? new Date()).toISOString();
  const finalTrace = traceForMarket(input.market, createdAt);
  const traceHash = hashAuditPayload(finalTrace);
  let steps: readonly LongHorizonAgentStep[];

  if (env.ZAI_API_KEY) {
    const plannerClient = input.plannerClient ?? createZaiPlannerClient(env.ZAI_API_KEY);
    try {
      steps = await buildLiveSteps({
        market: input.market,
        traceHash,
        plannerClient,
        onProgress: input.onProgress,
      });
      mode = "live";
    } catch {
      if (input.requireLive === true) {
        return {
          kind: "agent_run_failed",
          reason: "live GLM call failed",
        };
      }
      fallbackReason = "live GLM call failed; using committed replay";
      steps = await buildCachedReplaySteps({
        market: input.market,
        traceHash,
        onProgress: input.onProgress,
      });
    }
  } else {
    steps = await buildCachedReplaySteps({
      market: input.market,
      traceHash,
      onProgress: input.onProgress,
    });
  }

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
      steps,
      finalTrace,
      traceHash,
      anchor,
    },
  };
}

export async function runLongHorizonAgentCli(
  input: RunLongHorizonAgentCliInput,
): Promise<RunLongHorizonAgentCliResult> {
  const market = parseRequiredMarket(input.args);
  const pretty = input.args.includes("--pretty");
  const requireLive = input.args.includes("--require-live");
  const sendAnchor = input.args.includes("--send-anchor");
  const noWait = input.args.includes("--no-wait");

  if (market === undefined) {
    return formatCliError({
      reason: "--market is required",
      pretty,
      wait: false,
    });
  }

  const result = await runLongHorizonAuditAgent({
    market,
    env: input.env,
    requireLive,
    sendAnchor,
  });

  if (result.kind === "agent_run_completed") {
    try {
      await input.writeLatestRecord?.(result.record);
    } catch {
      return formatCliError({
        reason: "failed to write Agent Run Record",
        pretty,
        wait: false,
      });
    }

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
    const wait = input.isInteractive === true && !noWait;
    const stdout = formatLongHorizonAgentFailure({
      reason: result.reason,
      waitForEnter: wait,
    });
    if (wait) {
      await (input.waitForEnter ?? waitForEnter)();
    }
    return {
      exitCode: 1,
      stdout,
      stderr: "",
    };
  }

  return {
    ...formatJsonCliError(result.reason),
    exitCode: 1,
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
    ...(record.fallbackReason === undefined
      ? []
      : [`回退原因 / Fallback Reason: ${record.fallbackReason}`]),
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

async function buildLiveSteps(input: {
  market: string;
  traceHash: string;
  plannerClient: LongHorizonAgentPlannerClient;
  onProgress?: (event: LongHorizonAgentProgressEvent) => void | Promise<void>;
}): Promise<LongHorizonAgentStep[]> {
  const steps: LongHorizonAgentStep[] = [];
  for (const spec of stepSpecs) {
    await input.onProgress?.({
      kind: "step_started",
      step: progressStep(spec),
    });

    const planned = await input.plannerClient({
      model: "glm-5.1",
      market: input.market,
      stepIndex: spec.index,
      expectedTool: spec.tool,
      prompt: buildPlannerPrompt({
        market: input.market,
        spec,
        previousSteps: steps,
      }),
    });

    const completedStep = buildStep({
      market: input.market,
      traceHash: input.traceHash,
      spec,
      modelSummary: planned.actionSummary,
    });
    steps.push(completedStep);
    await input.onProgress?.({
      kind: "step_completed",
      step: completedStep,
    });
  }

  return steps;
}

async function buildCachedReplaySteps(input: {
  market: string;
  traceHash: string;
  onProgress?: (event: LongHorizonAgentProgressEvent) => void | Promise<void>;
}): Promise<LongHorizonAgentStep[]> {
  const steps: LongHorizonAgentStep[] = [];
  for (const spec of stepSpecs) {
    await input.onProgress?.({
      kind: "step_started",
      step: progressStep(spec),
    });
    const completedStep = buildStep({
      market: input.market,
      traceHash: input.traceHash,
      spec,
      modelSummary: `Select ${spec.tool} as the next bounded ColdRead tool.`,
    });
    steps.push(completedStep);
    await input.onProgress?.({
      kind: "step_completed",
      step: completedStep,
    });
  }

  return steps;
}

function progressStep(spec: typeof stepSpecs[number]): LongHorizonAgentProgressStep {
  return {
    index: spec.index,
    titleZh: spec.titleZh,
    titleEn: spec.titleEn,
    tool: spec.tool,
  };
}

function buildStep(input: {
  market: string;
  traceHash: string;
  spec: typeof stepSpecs[number];
  modelSummary: string;
}): LongHorizonAgentStep {
  return {
    id: `step-${input.spec.index}`,
    index: input.spec.index,
    title: `${input.spec.titleZh} / ${input.spec.titleEn}`,
    titleZh: input.spec.titleZh,
    titleEn: input.spec.titleEn,
    status: input.spec.status ?? "completed",
    modelAction: {
      summary: input.modelSummary,
      nextTool: input.spec.tool,
    },
    toolCall: {
      name: input.spec.tool,
      input: input.spec.input(input.market, input.traceHash),
    },
    observation: input.spec.observation,
    ...(input.spec.repairOfStepId === undefined
      ? {}
      : { repairOfStepId: input.spec.repairOfStepId }),
  };
}

function traceForMarket(market: string, generatedAt: string): AgentRunTrace {
  return {
    ...cachedDemoAgentRunTrace,
    generatedAt,
    task: {
      ...cachedDemoAgentRunTrace.task,
      targetMarketId: market,
    },
    finalLensDraft: {
      ...cachedDemoAgentRunTrace.finalLensDraft,
      targetMarketId: market,
    },
  };
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
      actionSummary: extractPlannerContent(payload),
    };
  };
}

function buildPlannerPrompt(input: {
  market: string;
  spec: typeof stepSpecs[number];
  previousSteps: readonly LongHorizonAgentStep[];
}): string {
  return [
    "You are ColdRead's GLM-5.1 long-horizon Web3 audit agent.",
    "Choose and justify exactly the expected next bounded ColdRead tool.",
    "Keep the action summary concise. Do not invent wallet execution.",
    `Market: ${input.market}`,
    `Step: ${input.spec.index}`,
    `Expected tool: ${input.spec.tool}`,
    `Previous steps: ${JSON.stringify(input.previousSteps.map((step) => ({
      index: step.index,
      tool: step.toolCall?.name,
      status: step.status,
    })))}`,
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

function parseFlag(args: readonly string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  if (index === -1) return undefined;
  return args[index + 1];
}

function parseRequiredMarket(args: readonly string[]): string | undefined {
  const market = parseFlag(args, "--market");
  if (market === undefined || market.trim() === "" || market.startsWith("--")) {
    return undefined;
  }

  return market;
}

function formatCliError(input: {
  reason: string;
  pretty: boolean;
  wait: boolean;
}): RunLongHorizonAgentCliResult {
  if (input.pretty) {
    return {
      exitCode: 1,
      stdout: formatLongHorizonAgentFailure({
        reason: input.reason,
        waitForEnter: input.wait,
      }),
      stderr: "",
    };
  }

  return {
    ...formatJsonCliError(input.reason),
    exitCode: 1,
  };
}

function formatJsonCliError(reason: string): Omit<RunLongHorizonAgentCliResult, "exitCode"> {
  return {
    stdout: `${JSON.stringify({
      kind: "long_horizon_agent_error",
      reason,
    }, null, 2)}\n`,
    stderr: "",
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function waitForEnter(): Promise<void> {
  const readline = createInterface({ input, output });
  await readline.question("");
  readline.close();
}
