import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("README presents ColdRead as a Hackathon-ready AI x Web3 audit trail project", async () => {
  const readme = await readFile("README.md", "utf8");
  const englishReadme = await readFile("README-en.md", "utf8");

  for (const required of [
    "AI x Web3",
    "可验证审计链路",
    "不是交易机器人",
    "GLM-5.1",
    "Agent Run Trace",
    "Decision Dossier",
    "Sepolia Audit Anchor",
    "README-en.md",
    "npm install",
    "npm run build",
    "npm run test",
    "npm run demo:live",
    "ZAI_API_KEY",
    "SEPOLIA_RPC_URL",
    "SEPOLIA_PRIVATE_KEY",
    "SEPOLIA_ANCHOR_TO",
    "当前已实现",
    "缓存与演示回退",
    "演示叙事",
  ]) {
    assert.match(readme, new RegExp(escapeRegExp(required)));
  }

  for (const required of [
    "ColdRead is an AI x Web3 Verifiable Audit Trail system",
    "not a trading bot",
    "GLM-5.1",
    "Agent Run Trace",
    "Decision Dossier",
    "Sepolia Audit Anchor",
  ]) {
    assert.match(englishReadme, new RegExp(escapeRegExp(required)));
  }
});

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
