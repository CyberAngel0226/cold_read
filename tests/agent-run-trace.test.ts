import assert from "node:assert/strict";
import test from "node:test";

import {
  cachedDemoAgentRunTrace,
  generateOrLoadAgentRunTrace,
  parseAgentRunTraceJson,
  type AgentRunTrace,
} from "../src/agent-run-trace.js";
import type { LivePolymarketMarketEvidence } from "../src/live-polymarket-market.js";

const marketEvidence: LivePolymarketMarketEvidence = {
  id: "123",
  conditionId: "0xabc",
  slug: "fed-cuts-in-july",
  question: "Will the Fed cut interest rates in July 2026?",
  outcomes: ["YES", "NO"],
  prices: {
    YES: 0.88,
    NO: 0.12,
  },
  status: "active",
  volume: 1_200_000,
  liquidity: 350_000,
  closeTime: "2026-07-10T00:00:00Z",
  resolutionRules: "Resolves YES if the Federal Reserve announces a rate cut.",
  source: "polymarket",
  sourceUrl: "https://polymarket.com/event/fed-cuts-in-july",
  raw: {},
};

test("accepts the committed cached GLM-5.1 Agent Run Trace", () => {
  const trace = parseAgentRunTraceJson(JSON.stringify(cachedDemoAgentRunTrace));

  assert.equal(trace.kind, "valid");
  assert.equal(trace.trace.engine, "GLM-5.1");
  assert.equal(trace.trace.steps.length >= 6, true);
  assert.equal(trace.trace.finalLensDraft.targetMarketId, cachedDemoAgentRunTrace.task.targetMarketId);
});

test("rejects malformed model JSON before it can enter the decision pipeline", () => {
  const trace = parseAgentRunTraceJson(JSON.stringify({
    engine: "GLM-5.1",
    generatedAt: "2026-06-12T00:00:00.000Z",
    task: {
      targetMarketId: "fed-cuts-in-july",
      objective: "Analyze market.",
    },
    steps: [],
    finalLensDraft: {
      action: "YOLO",
      targetMarketId: "fed-cuts-in-july",
      confidence: 1.5,
      riskLevel: "none",
      rationale: "",
      evidenceRefs: [],
      externalRiskFlags: [],
    },
  }));

  assert.equal(trace.kind, "invalid");
  assert.match(trace.message, /steps/);
});

test("uses the cached demo trace when ZAI_API_KEY is absent", async () => {
  let calls = 0;

  const result = await generateOrLoadAgentRunTrace({
    marketEvidence,
    modelClient: async () => {
      calls += 1;
      return JSON.stringify(validGeneratedTrace());
    },
  });

  assert.equal(result.source, "cached_demo");
  assert.equal(result.fallbackReason, "missing_api_key");
  assert.equal(calls, 0);
  assert.equal(result.trace.finalLensDraft.targetMarketId, marketEvidence.slug);
});

test("uses a generated GLM trace when the injected model client returns valid JSON", async () => {
  const generated = validGeneratedTrace();

  const result = await generateOrLoadAgentRunTrace({
    marketEvidence,
    apiKey: "test-key",
    modelClient: async (request) => {
      assert.equal(request.model, "glm-5.1");
      assert.equal(request.marketEvidence.slug, "fed-cuts-in-july");
      return JSON.stringify(generated);
    },
  });

  assert.equal(result.source, "glm_api");
  assert.deepEqual(result.trace, generated);
});

test("falls back to the cached trace when model JSON is malformed", async () => {
  const result = await generateOrLoadAgentRunTrace({
    marketEvidence,
    apiKey: "test-key",
    modelClient: async () => JSON.stringify({ engine: "GLM-5.1" }),
  });

  assert.equal(result.source, "cached_demo");
  assert.equal(result.fallbackReason, "invalid_model_json");
  assert.equal(result.trace.finalLensDraft.targetMarketId, marketEvidence.slug);
});

function validGeneratedTrace(): AgentRunTrace {
  return {
    engine: "GLM-5.1",
    generatedAt: "2026-06-12T00:00:00.000Z",
    task: {
      targetMarketId: "fed-cuts-in-july",
      objective: "Analyze a live Polymarket market and draft an auditable lens decision.",
    },
    steps: [
      {
        id: "step-1",
        title: "Load live market evidence",
        phase: "observe_market",
        observation: "The market is active and exposes YES/NO prices.",
        evidenceRefs: ["market.slug", "market.prices"],
      },
      {
        id: "step-2",
        title: "Check risk",
        phase: "risk_check",
        observation: "High implied probability leaves little margin of safety.",
        riskChecks: ["Do not execute without user approval."],
        evidenceRefs: ["market.prices.YES"],
      },
      {
        id: "step-3",
        title: "Self-correct",
        phase: "self_correction",
        observation: "The agent downgrades the action from buy to hold.",
        selfCorrections: ["Avoid overconfident execution from price alone."],
        evidenceRefs: ["market.resolutionRules"],
      },
    ],
    finalLensDraft: {
      action: "HOLD",
      targetMarketId: "fed-cuts-in-july",
      confidence: 0.62,
      riskLevel: "medium",
      rationale: "The market is live, but current price and thin context do not justify autonomous execution.",
      evidenceRefs: ["market.prices.YES", "market.resolutionRules"],
      externalRiskFlags: ["Needs external news confirmation before buy."],
    },
  };
}
