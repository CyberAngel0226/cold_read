import assert from "node:assert/strict";
import test from "node:test";

import {
  auditJson,
  auditSummary,
  decisionRunDetail,
  decisionRuns,
} from "../app/data/mockData.js";

test("dashboard demo data presents the GLM long-horizon Sepolia audit story", () => {
  assert.equal(decisionRuns[0]?.topic, "New Rihanna Album before GTA VI?");
  assert.equal(decisionRuns[0]?.stage, "GLM-5.1 long-horizon audit complete");
  assert.equal(decisionRuns[0]?.finalAction, "HOLD");
  assert.equal(decisionRuns[0]?.auditStatus, "ANCHOR");
  assert.equal(decisionRuns[0]?.strategyName, "Z.AI Hackathon demo");

  assert.equal(decisionRunDetail.topic, "New Rihanna Album before GTA VI?");
  assert.equal(decisionRunDetail.finalDecision.action, "HOLD");
  assert.equal(decisionRunDetail.auditStatus, "SEPOLIA READY");
  assert.equal(decisionRunDetail.agentRunTrace.length, 6);
  assert.equal(decisionRunDetail.agentRunTrace[3]?.status, "failed");
  assert.match(decisionRunDetail.agentRunTrace[4]?.title ?? "", /Self repair/);
  assert.match(decisionRunDetail.traceHash, /^[0-9a-f]{64}$/);
  assert.match(decisionRunDetail.calldata, /^0x[0-9a-f]{64}$/);
  assert.match(decisionRunDetail.explorerLink, /^https:\/\/sepolia\.etherscan\.io\/tx\//);
});

test("dashboard audit copy exposes copyable GLM trace and Sepolia anchor evidence", () => {
  const summary = auditSummary(decisionRunDetail);
  assert.match(summary, /GLM-5\.1/);
  assert.match(summary, /Trace Hash:/);
  assert.match(summary, /Sepolia:/);

  const auditPacket = JSON.parse(auditJson(decisionRunDetail)) as {
    engine: string;
    mode: string;
    traceHash: string;
    calldata: string;
    explorerLink: string;
  };

  assert.equal(auditPacket.engine, "GLM-5.1");
  assert.equal(auditPacket.mode, "live");
  assert.equal(auditPacket.traceHash, decisionRunDetail.traceHash);
  assert.equal(auditPacket.calldata, decisionRunDetail.calldata);
  assert.equal(auditPacket.explorerLink, decisionRunDetail.explorerLink);
});
