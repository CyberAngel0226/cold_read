import assert from "node:assert/strict";
import test from "node:test";

import { runMvpDecisionRunApi } from "../src/mvp-decision-run-api.js";

test("MVP Decision Run API returns a Decision Dossier for a submitted topic", async () => {
  const response = await runMvpDecisionRunApi({
    topicText: "Fed rate cut",
    now: "2026-06-10T00:00:00.000Z",
  });

  assert.equal(response.status, 201);
  assert.equal(response.body.kind, "decision_run_complete");

  if (response.body.kind !== "decision_run_complete") {
    throw new Error("expected a Decision Dossier");
  }

  assert.equal(response.body.dossier.topic.text, "Fed rate cut");
  assert.equal(response.body.dossier.finalDecision.action, "BUY_YES_SMALL");
  assert.equal(response.body.dossier.auditAnchors.length, 1);
  assert.ok(response.body.dossier.timeline.length >= 8);
});

test("MVP Decision Run API returns a Screening Outcome when no market passes screening", async () => {
  const response = await runMvpDecisionRunApi({
    topicText: "no screened market",
    now: "2026-06-10T00:00:00.000Z",
  });

  assert.equal(response.status, 201);
  assert.equal(response.body.kind, "screening_outcome");

  if (response.body.kind !== "screening_outcome") {
    throw new Error("expected a Screening Outcome");
  }

  assert.equal(response.body.outcome.status, "NO_SCREENED_MARKETS");
});
