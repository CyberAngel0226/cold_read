import json
import subprocess
import sys
import unittest
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from agents.market_structure_lens import (
    build_market_structure_llm_request,
    load_evidence_snapshot,
)

FIXTURE_PATH = (
    PROJECT_ROOT / "tests" / "fixtures" / "evidence-snapshot.market-structure.json"
)


class MarketStructureLensReaderTest(unittest.TestCase):
    def test_loads_snapshot_file_and_builds_llm_request(self) -> None:
        snapshot = load_evidence_snapshot(str(FIXTURE_PATH))
        llm_request = build_market_structure_llm_request(snapshot)

        self.assertEqual(llm_request["input"]["snapshotId"], "snapshot_1")
        self.assertEqual(llm_request["input"]["decisionRunId"], "run_1")
        self.assertEqual(
            llm_request["input"]["markets"][0]["id"],
            "screened_candidate_poly_1",
        )
        self.assertIn("Market Structure Lens", llm_request["messages"][0]["content"])
        self.assertEqual(
            llm_request["requiredOutput"]["action"],
            "BUY_YES_SMALL | BUY_NO_SMALL | HOLD",
        )

    def test_cli_can_emit_an_llm_request_from_a_snapshot_file(self) -> None:
        result = subprocess.run(
            [
                "python3",
                "agents/market_structure_lens.py",
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
        self.assertEqual(llm_request["version"], "market_structure_lens.v1")
        self.assertEqual(llm_request["input"]["snapshotId"], "snapshot_1")


if __name__ == "__main__":
    unittest.main()
