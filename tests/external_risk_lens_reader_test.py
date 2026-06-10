import json
import subprocess
import sys
import unittest
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from agents.external_risk_lens import (
    build_external_risk_llm_request,
    generate_external_risk_draft,
    load_evidence_snapshot,
)

FIXTURE_PATH = (
    PROJECT_ROOT / "tests" / "fixtures" / "evidence-snapshot.external-risk.json"
)


class ExternalRiskLensReaderTest(unittest.TestCase):
    def test_loads_snapshot_file_and_builds_llm_request(self) -> None:
        snapshot = load_evidence_snapshot(str(FIXTURE_PATH))
        llm_request = build_external_risk_llm_request(snapshot)

        self.assertEqual(llm_request["version"], "external_risk_lens.v1")
        self.assertEqual(llm_request["input"]["snapshotId"], "snapshot_external_1")
        self.assertEqual(llm_request["input"]["decisionRunId"], "run_1")
        self.assertEqual(
            llm_request["input"]["contextEvidence"][0]["id"],
            "context_clean_1",
        )
        self.assertIn("External Risk Lens", llm_request["messages"][0]["content"])
        self.assertEqual(
            llm_request["requiredOutput"]["action"],
            "BUY_YES_SMALL | BUY_NO_SMALL | HOLD",
        )

    def test_generates_low_risk_consensus_following_draft(self) -> None:
        snapshot = load_evidence_snapshot(str(FIXTURE_PATH))

        draft = generate_external_risk_draft(snapshot)

        self.assertEqual(draft["action"], "BUY_YES_SMALL")
        self.assertEqual(draft["targetMarketId"], "screened_candidate_poly_1")
        self.assertEqual(draft["confidence"], "MEDIUM")
        self.assertEqual(draft["riskLevel"], "LOW")
        self.assertEqual(draft["evidenceRefs"], ["context_clean_1"])
        self.assertEqual(draft["externalRiskFlags"], [])

    def test_generates_hold_when_context_has_major_counterevidence(self) -> None:
        snapshot = load_evidence_snapshot(str(FIXTURE_PATH))
        snapshot["contextEvidence"]["items"][0]["summary"] = (
            "Major counterevidence could undermine the one-sided signal."
        )

        draft = generate_external_risk_draft(snapshot)

        self.assertEqual(draft["action"], "HOLD")
        self.assertNotIn("targetMarketId", draft)
        self.assertEqual(draft["confidence"], "LOW")
        self.assertEqual(draft["riskLevel"], "HIGH")
        self.assertEqual(draft["evidenceRefs"], ["context_clean_1"])
        self.assertEqual(draft["externalRiskFlags"], ["MAJOR_COUNTEREVIDENCE"])

    def test_cli_can_emit_an_llm_request_from_a_snapshot_file(self) -> None:
        result = subprocess.run(
            [
                sys.executable,
                "agents/external_risk_lens.py",
                "--snapshot-file",
                str(FIXTURE_PATH),
                "--mode",
                "llm-request",
            ],
            cwd=PROJECT_ROOT,
            capture_output=True,
            check=True,
            text=True,
        )

        llm_request = json.loads(result.stdout)
        self.assertEqual(llm_request["version"], "external_risk_lens.v1")
        self.assertEqual(llm_request["input"]["snapshotId"], "snapshot_external_1")


if __name__ == "__main__":
    unittest.main()
