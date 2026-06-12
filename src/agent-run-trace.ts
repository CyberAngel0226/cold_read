import cachedTrace from "../demo/glm-agent-run-trace.json" with { type: "json" };
import type { LivePolymarketMarketEvidence } from "./live-polymarket-market.js";

export type AgentRunTracePhase =
  | "plan"
  | "observe_market"
  | "observe_context"
  | "risk_check"
  | "self_correction"
  | "veto_check"
  | "audit_prepare";

export type AgentRunTraceAction = "BUY_YES_SMALL" | "BUY_NO_SMALL" | "HOLD" | "REJECT";
export type AgentRunTraceRiskLevel = "low" | "medium" | "high";

export type AgentRunTraceStep = {
  id: string;
  title: string;
  phase: AgentRunTracePhase;
  observation: string;
  evidenceRefs: readonly string[];
  riskChecks?: readonly string[];
  selfCorrections?: readonly string[];
};

export type AgentRunTraceFinalLensDraft = {
  action: AgentRunTraceAction;
  targetMarketId: string;
  confidence: number;
  riskLevel: AgentRunTraceRiskLevel;
  rationale: string;
  evidenceRefs: readonly string[];
  externalRiskFlags: readonly string[];
};

export type AgentRunTrace = {
  engine: "GLM-5.1";
  generatedAt: string;
  task: {
    targetMarketId: string;
    objective: string;
  };
  steps: readonly AgentRunTraceStep[];
  finalLensDraft: AgentRunTraceFinalLensDraft;
};

export type AgentRunTraceModelRequest = {
  model: string;
  marketEvidence: LivePolymarketMarketEvidence;
  prompt: string;
};

export type AgentRunTraceModelClient = (
  request: AgentRunTraceModelRequest,
) => Promise<string>;

export type GenerateOrLoadAgentRunTraceInput = {
  marketEvidence: LivePolymarketMarketEvidence;
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  modelClient?: AgentRunTraceModelClient;
  now?: Date;
};

export type AgentRunTraceResult = {
  source: "glm_api" | "cached_demo";
  trace: AgentRunTrace;
  fallbackReason?: "missing_api_key" | "model_call_failed" | "invalid_model_json";
};

export type ParseAgentRunTraceResult =
  | {
      kind: "valid";
      trace: AgentRunTrace;
    }
  | {
      kind: "invalid";
      message: string;
    };

const DEFAULT_ZAI_MODEL = "glm-5.1";
const DEFAULT_ZAI_BASE_URL = "https://open.bigmodel.cn/api/paas/v4/chat/completions";
const validPhases = new Set<AgentRunTracePhase>([
  "plan",
  "observe_market",
  "observe_context",
  "risk_check",
  "self_correction",
  "veto_check",
  "audit_prepare",
]);
const validActions = new Set<AgentRunTraceAction>([
  "BUY_YES_SMALL",
  "BUY_NO_SMALL",
  "HOLD",
  "REJECT",
]);
const validRiskLevels = new Set<AgentRunTraceRiskLevel>(["low", "medium", "high"]);

export const cachedDemoAgentRunTrace: AgentRunTrace =
  loadCachedDemoAgentRunTrace(cachedTrace);

export async function generateOrLoadAgentRunTrace(
  input: GenerateOrLoadAgentRunTraceInput,
): Promise<AgentRunTraceResult> {
  const cached = traceForMarket(input.marketEvidence, input.now ?? new Date());
  const apiKey = input.apiKey ?? process.env.ZAI_API_KEY;

  if (apiKey === undefined || apiKey.trim() === "") {
    return {
      source: "cached_demo",
      fallbackReason: "missing_api_key",
      trace: cached,
    };
  }

  const model = input.model ?? process.env.ZAI_MODEL ?? DEFAULT_ZAI_MODEL;
  const modelClient =
    input.modelClient ??
    createZaiAgentRunTraceClient({
      apiKey,
      baseUrl: input.baseUrl ?? process.env.ZAI_API_BASE_URL ?? DEFAULT_ZAI_BASE_URL,
    });

  let modelJson: string;
  try {
    modelJson = await modelClient({
      model,
      marketEvidence: input.marketEvidence,
      prompt: buildAgentRunTracePrompt(input.marketEvidence),
    });
  } catch {
    return {
      source: "cached_demo",
      fallbackReason: "model_call_failed",
      trace: cached,
    };
  }

  const parsed = parseAgentRunTraceJson(modelJson);
  if (parsed.kind === "invalid") {
    return {
      source: "cached_demo",
      fallbackReason: "invalid_model_json",
      trace: cached,
    };
  }

  return {
    source: "glm_api",
    trace: parsed.trace,
  };
}

export function parseAgentRunTraceJson(json: string): ParseAgentRunTraceResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return {
      kind: "invalid",
      message: "Trace is not valid JSON.",
    };
  }

  return validateAgentRunTrace(parsed);
}

export function buildAgentRunTracePrompt(
  marketEvidence: LivePolymarketMarketEvidence,
): string {
  return [
    "You are ColdRead, an AI x Web3 auditable decision agent.",
    "Return only JSON matching the AgentRunTrace schema.",
    "Show long-horizon reasoning as compact, evidence-referenced steps.",
    "Include observations, risk checks, self-corrections, and a final lens draft.",
    "Do not claim wallet execution. ColdRead requires explicit user approval before execution.",
    "",
    `Market evidence: ${JSON.stringify(marketEvidence)}`,
  ].join("\n");
}

function createZaiAgentRunTraceClient(input: {
  apiKey: string;
  baseUrl: string;
}): AgentRunTraceModelClient {
  return async ({ model, prompt }) => {
    const response = await fetch(input.baseUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        response_format: {
          type: "json_object",
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Z.AI request failed with ${response.status}.`);
    }

    const payload = await response.json();
    return extractChatCompletionContent(payload);
  };
}

function validateAgentRunTrace(value: unknown): ParseAgentRunTraceResult {
  if (!isRecord(value)) {
    return invalid("Trace must be an object.");
  }

  if (value.engine !== "GLM-5.1") {
    return invalid("Trace engine must be GLM-5.1.");
  }

  if (!isNonEmptyString(value.generatedAt)) {
    return invalid("Trace generatedAt is required.");
  }

  if (!isRecord(value.task)) {
    return invalid("Trace task is required.");
  }

  if (!isNonEmptyString(value.task.targetMarketId)) {
    return invalid("Trace task.targetMarketId is required.");
  }

  if (!isNonEmptyString(value.task.objective)) {
    return invalid("Trace task.objective is required.");
  }

  if (!Array.isArray(value.steps) || value.steps.length === 0) {
    return invalid("Trace steps must include at least one step.");
  }

  const steps: AgentRunTraceStep[] = [];
  for (const [index, step] of value.steps.entries()) {
    const parsed = parseStep(step, index);
    if (parsed.kind === "invalid") return parsed;
    steps.push(parsed.step);
  }

  const finalLensDraft = parseFinalLensDraft(value.finalLensDraft);
  if (finalLensDraft.kind === "invalid") return finalLensDraft;

  return {
    kind: "valid",
    trace: {
      engine: "GLM-5.1",
      generatedAt: value.generatedAt,
      task: {
        targetMarketId: value.task.targetMarketId,
        objective: value.task.objective,
      },
      steps,
      finalLensDraft: finalLensDraft.draft,
    },
  };
}

function parseStep(
  value: unknown,
  index: number,
): { kind: "valid"; step: AgentRunTraceStep } | { kind: "invalid"; message: string } {
  if (!isRecord(value)) {
    return invalid(`Trace steps[${index}] must be an object.`);
  }

  if (!isNonEmptyString(value.id)) {
    return invalid(`Trace steps[${index}].id is required.`);
  }

  if (!isNonEmptyString(value.title)) {
    return invalid(`Trace steps[${index}].title is required.`);
  }

  if (!isAgentRunTracePhase(value.phase)) {
    return invalid(`Trace steps[${index}].phase is invalid.`);
  }

  if (!isNonEmptyString(value.observation)) {
    return invalid(`Trace steps[${index}].observation is required.`);
  }

  const evidenceRefs = parseStringArray(value.evidenceRefs);
  if (evidenceRefs === undefined || evidenceRefs.length === 0) {
    return invalid(`Trace steps[${index}].evidenceRefs must include at least one ref.`);
  }

  const riskChecks = parseOptionalStringArray(value.riskChecks);
  if (riskChecks === undefined) {
    return invalid(`Trace steps[${index}].riskChecks must be strings when present.`);
  }

  const selfCorrections = parseOptionalStringArray(value.selfCorrections);
  if (selfCorrections === undefined) {
    return invalid(`Trace steps[${index}].selfCorrections must be strings when present.`);
  }

  return {
    kind: "valid",
    step: {
      id: value.id,
      title: value.title,
      phase: value.phase,
      observation: value.observation,
      evidenceRefs,
      ...(riskChecks.length === 0 ? {} : { riskChecks }),
      ...(selfCorrections.length === 0 ? {} : { selfCorrections }),
    },
  };
}

function parseFinalLensDraft(
  value: unknown,
): { kind: "valid"; draft: AgentRunTraceFinalLensDraft } | { kind: "invalid"; message: string } {
  if (!isRecord(value)) {
    return invalid("Trace finalLensDraft is required.");
  }

  if (!isAgentRunTraceAction(value.action)) {
    return invalid("Trace finalLensDraft.action is invalid.");
  }

  if (!isNonEmptyString(value.targetMarketId)) {
    return invalid("Trace finalLensDraft.targetMarketId is required.");
  }

  if (typeof value.confidence !== "number" || value.confidence < 0 || value.confidence > 1) {
    return invalid("Trace finalLensDraft.confidence must be between 0 and 1.");
  }

  if (!isAgentRunTraceRiskLevel(value.riskLevel)) {
    return invalid("Trace finalLensDraft.riskLevel is invalid.");
  }

  if (!isNonEmptyString(value.rationale)) {
    return invalid("Trace finalLensDraft.rationale is required.");
  }

  const evidenceRefs = parseStringArray(value.evidenceRefs);
  if (evidenceRefs === undefined || evidenceRefs.length === 0) {
    return invalid("Trace finalLensDraft.evidenceRefs must include at least one ref.");
  }

  const externalRiskFlags = parseStringArray(value.externalRiskFlags);
  if (externalRiskFlags === undefined) {
    return invalid("Trace finalLensDraft.externalRiskFlags must be strings.");
  }

  return {
    kind: "valid",
    draft: {
      action: value.action,
      targetMarketId: value.targetMarketId,
      confidence: value.confidence,
      riskLevel: value.riskLevel,
      rationale: value.rationale,
      evidenceRefs,
      externalRiskFlags,
    },
  };
}

function traceForMarket(
  marketEvidence: LivePolymarketMarketEvidence,
  generatedAt: Date,
): AgentRunTrace {
  const targetMarketId = marketEvidence.slug ?? marketEvidence.conditionId ?? marketEvidence.id;
  return {
    ...cachedDemoAgentRunTrace,
    generatedAt: generatedAt.toISOString(),
    task: {
      ...cachedDemoAgentRunTrace.task,
      targetMarketId,
    },
    finalLensDraft: {
      ...cachedDemoAgentRunTrace.finalLensDraft,
      targetMarketId,
    },
  };
}

function loadCachedDemoAgentRunTrace(value: unknown): AgentRunTrace {
  const parsed = validateAgentRunTrace(value);
  if (parsed.kind === "invalid") {
    throw new Error(`Cached GLM Agent Run Trace is invalid: ${parsed.message}`);
  }

  return parsed.trace;
}

function extractChatCompletionContent(payload: unknown): string {
  if (!isRecord(payload) || !Array.isArray(payload.choices)) {
    throw new Error("Z.AI response did not include choices.");
  }

  const firstChoice = payload.choices[0];
  if (!isRecord(firstChoice) || !isRecord(firstChoice.message)) {
    throw new Error("Z.AI response did not include a message.");
  }

  const { content } = firstChoice.message;
  if (!isNonEmptyString(content)) {
    throw new Error("Z.AI response message content is empty.");
  }

  return content;
}

function parseStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const strings = value.filter(isNonEmptyString);
  return strings.length === value.length ? strings : undefined;
}

function parseOptionalStringArray(value: unknown): string[] | undefined {
  if (value === undefined) return [];
  return parseStringArray(value);
}

function isAgentRunTracePhase(value: unknown): value is AgentRunTracePhase {
  return typeof value === "string" && validPhases.has(value as AgentRunTracePhase);
}

function isAgentRunTraceAction(value: unknown): value is AgentRunTraceAction {
  return typeof value === "string" && validActions.has(value as AgentRunTraceAction);
}

function isAgentRunTraceRiskLevel(value: unknown): value is AgentRunTraceRiskLevel {
  return typeof value === "string" && validRiskLevels.has(value as AgentRunTraceRiskLevel);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

function invalid(message: string): { kind: "invalid"; message: string } {
  return {
    kind: "invalid",
    message,
  };
}
