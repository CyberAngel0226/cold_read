import assert from "node:assert/strict";
import test from "node:test";

import {
  formatLongHorizonAgentPrettyOutput,
  runLongHorizonAgentCli,
  runLongHorizonAuditAgent,
} from "../src/long-horizon-agent.js";

const market = "new-rhianna-album-before-gta-vi-926";
const anchorTo = "0xED3802DDD5E1a700FD2071F32a2c6f5ea9415a51";

test("cached replay produces a long-horizon Agent Run Record with validation repair", async () => {
  const result = await runLongHorizonAuditAgent({
    market,
    env: {
      SEPOLIA_ANCHOR_TO: anchorTo,
    },
    now: new Date("2026-06-13T00:00:00.000Z"),
  });

  assert.equal(result.kind, "agent_run_completed");
  assert.equal(result.record.engine, "GLM-5.1");
  assert.equal(result.record.mode, "cached_replay");
  assert.equal(result.record.market, market);
  assert.equal(result.record.steps.length, 6);
  assert.equal(
    result.record.steps.some((step) => step.status === "failed" && step.toolCall?.name === "validate_agent_trace"),
    true,
  );
  assert.equal(
    result.record.steps.some((step) => step.repairOfStepId !== undefined && step.status === "completed"),
    true,
  );
  assert.equal(result.record.finalTrace.finalLensDraft.action, "HOLD");
  assert.match(result.record.traceHash, /^[0-9a-f]{64}$/);
  assert.equal(result.record.anchor.status, "DRY_RUN");
  assert.equal(result.record.anchor.to, anchorTo);
});

test("pretty output shows a bilingual long-horizon task pipeline", async () => {
  const result = await runLongHorizonAuditAgent({
    market,
    env: {
      SEPOLIA_ANCHOR_TO: anchorTo,
    },
    now: new Date("2026-06-13T00:00:00.000Z"),
  });

  assert.equal(result.kind, "agent_run_completed");
  const pretty = formatLongHorizonAgentPrettyOutput(result.record);

  assert.match(pretty, /🧊 ColdRead GLM-5\.1 长程审计 Agent \/ Audit Agent/);
  assert.match(pretty, /引擎 \/ Engine: GLM-5\.1 cached replay/);
  assert.match(pretty, /✅ Step 1 任务拆解 \/ Plan task/);
  assert.match(pretty, /⚠️ Step 4 轨迹校验失败 \/ Trace validation failed/);
  assert.match(pretty, /✅ Step 5 自我修复 \/ Self repair/);
  assert.match(pretty, new RegExp(`目标地址 / To: ${anchorTo}`));
  assert.match(pretty, /最终交付 \/ Deliverable/);
});

test("require-live failure in pretty interactive mode waits for Enter", async () => {
  let waited = false;
  const result = await runLongHorizonAgentCli({
    args: ["--market", market, "--require-live", "--pretty"],
    env: {},
    isInteractive: true,
    waitForEnter: async () => {
      waited = true;
    },
  });

  assert.equal(result.exitCode, 1);
  assert.equal(waited, true);
  assert.match(result.stdout, /❌ 需要实时 GLM-5\.1 \/ Live GLM-5\.1 required/);
  assert.match(result.stdout, /按 Enter 退出 \/ Press Enter to exit/);
});

test("live mode calls GLM-5.1 planner across the bounded multi-step run", async () => {
  const plannerCalls: number[] = [];
  const result = await runLongHorizonAuditAgent({
    market,
    env: {
      ZAI_API_KEY: "test-key",
      SEPOLIA_ANCHOR_TO: anchorTo,
    },
    now: new Date("2026-06-13T00:00:00.000Z"),
    plannerClient: async (request) => {
      plannerCalls.push(request.stepIndex);
      assert.equal(request.model, "glm-5.1");
      assert.equal(request.market, market);
      return {
        actionSummary: `GLM chooses ${request.expectedTool} for step ${request.stepIndex}.`,
      };
    },
  });

  assert.equal(result.kind, "agent_run_completed");
  assert.deepEqual(plannerCalls, [1, 2, 3, 4, 5, 6]);
  assert.equal(result.record.mode, "live");
  assert.match(result.record.steps[0].modelAction.summary, /plan_task/);
  assert.match(result.record.steps[5].modelAction.summary, /prepare_sepolia_anchor/);
});

test("live mode falls back transparently to cached replay when GLM call fails", async () => {
  const result = await runLongHorizonAuditAgent({
    market,
    env: {
      ZAI_API_KEY: "test-key",
      SEPOLIA_ANCHOR_TO: anchorTo,
    },
    plannerClient: async () => {
      throw new Error("network failed");
    },
  });

  assert.equal(result.kind, "agent_run_completed");
  assert.equal(result.record.mode, "cached_replay");
  assert.equal(result.record.fallbackReason, "live GLM call failed; using committed replay");
});

test("require-live fails when GLM call fails", async () => {
  const result = await runLongHorizonAuditAgent({
    market,
    requireLive: true,
    env: {
      ZAI_API_KEY: "test-key",
      SEPOLIA_ANCHOR_TO: anchorTo,
    },
    plannerClient: async () => {
      throw new Error("network failed");
    },
  });

  assert.equal(result.kind, "agent_run_failed");
  assert.equal(result.reason, "live GLM call failed");
});

test("require-live JSON failure does not wait and stays parseable", async () => {
  let waited = false;
  const result = await runLongHorizonAgentCli({
    args: ["--market", market, "--require-live"],
    env: {},
    isInteractive: true,
    waitForEnter: async () => {
      waited = true;
    },
  });

  assert.equal(result.exitCode, 1);
  assert.equal(waited, false);
  assert.equal(JSON.parse(result.stdout).kind, "long_horizon_agent_error");
});

test("CLI fails clearly when --market is missing", async () => {
  const result = await runLongHorizonAgentCli({
    args: [],
    env: {
      SEPOLIA_ANCHOR_TO: anchorTo,
    },
  });

  assert.equal(result.exitCode, 1);
  const error = JSON.parse(result.stdout);
  assert.equal(error.kind, "long_horizon_agent_error");
  assert.equal(error.reason, "--market is required");
});

test("CLI fails clearly when --market has no value", async () => {
  const result = await runLongHorizonAgentCli({
    args: ["--market", "--require-live"],
    env: {
      SEPOLIA_ANCHOR_TO: anchorTo,
    },
  });

  assert.equal(result.exitCode, 1);
  const error = JSON.parse(result.stdout);
  assert.equal(error.kind, "long_horizon_agent_error");
  assert.equal(error.reason, "--market is required");
});

test("CLI renders a pretty failure when --market has no value in pretty mode", async () => {
  const result = await runLongHorizonAgentCli({
    args: ["--market", "--pretty"],
    env: {
      SEPOLIA_ANCHOR_TO: anchorTo,
    },
  });

  assert.equal(result.exitCode, 1);
  assert.match(result.stdout, /❌ 需要实时 GLM-5\.1 \/ Live GLM-5\.1 required/);
  assert.match(result.stdout, /原因 \/ Reason: --market is required/);
});

test("CLI writes the latest Agent Run Record on successful runs", async () => {
  let writtenMarket: string | undefined;
  const result = await runLongHorizonAgentCli({
    args: ["--market", market],
    env: {
      SEPOLIA_ANCHOR_TO: anchorTo,
    },
    writeLatestRecord: async (record) => {
      writtenMarket = record.market;
    },
  });

  assert.equal(result.exitCode, 0);
  assert.equal(writtenMarket, market);
  assert.equal(JSON.parse(result.stdout).kind, "long_horizon_agent_run");
});

test("CLI returns a failed exit code when latest Agent Run Record write fails", async () => {
  const result = await runLongHorizonAgentCli({
    args: ["--market", market],
    env: {
      SEPOLIA_ANCHOR_TO: anchorTo,
    },
    writeLatestRecord: async () => {
      throw new Error("disk full");
    },
  });

  assert.equal(result.exitCode, 1);
  const error = JSON.parse(result.stdout);
  assert.equal(error.kind, "long_horizon_agent_error");
  assert.equal(error.reason, "failed to write Agent Run Record");
});
