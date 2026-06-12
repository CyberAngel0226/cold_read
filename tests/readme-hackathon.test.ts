import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("README presents ColdRead as a Hackathon-ready AI x Web3 audit trail project", async () => {
  const readme = await readFile("README.md", "utf8");

  for (const required of [
    "AI x Web3",
    "Verifiable Audit Trail",
    "not a trading bot",
    "GLM-5.1",
    "Agent Run Trace",
    "Decision Dossier",
    "Sepolia Audit Anchor",
    "npm install",
    "npm run build",
    "npm run test",
    "npm run demo:live",
    "ZAI_API_KEY",
    "ZAI_MODEL",
    "SEPOLIA_RPC_URL",
    "SEPOLIA_PRIVATE_KEY",
    "SEPOLIA_ANCHOR_TO",
    "Live today",
    "Cached/demo fallback",
    "Demo narrative",
  ]) {
    assert.match(readme, new RegExp(escapeRegExp(required)));
  }
});

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
