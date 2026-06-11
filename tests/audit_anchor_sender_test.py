import json
import subprocess
import sys
import unittest
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from agents.audit_anchor_sender import (
    build_anchor_transaction_payload,
    load_anchor_request,
    send_audit_anchor,
)


def make_anchor_request() -> dict:
    return {
        "version": "coldread.audit-anchor.v1",
        "network": "testnet",
        "decisionRunId": "run_1",
        "dossierId": "dossier_1",
        "contentHash": "abc123",
        "hashAlgorithm": "sha256",
        "canonicalization": "coldread-json-v1",
        "sectionHashes": {
            "evidenceSnapshot": "evidence_hash",
            "agentRecommendations": "recommendations_hash",
            "finalDecision": "final_decision_hash",
        },
    }


class AuditAnchorSenderTest(unittest.TestCase):
    def test_dry_run_returns_json_metadata_without_private_key(self) -> None:
        request = make_anchor_request()

        result = send_audit_anchor(request, mode="dry-run", env={})

        self.assertEqual(result["status"], "DRY_RUN")
        self.assertEqual(result["network"], "testnet")
        self.assertNotIn("transactionHash", result)
        self.assertEqual(result["contentHash"], "abc123")
        self.assertIn("serializedPayload", result)

    def test_builds_minimal_transaction_payload_without_full_dossier_content(self) -> None:
        payload = build_anchor_transaction_payload(make_anchor_request())

        self.assertEqual(payload["decisionRunId"], "run_1")
        self.assertEqual(payload["dossierId"], "dossier_1")
        self.assertEqual(payload["contentHash"], "abc123")
        serialized = json.dumps(payload, sort_keys=True)
        self.assertNotIn("Fed rate cut", serialized)
        self.assertNotIn("evidenceSnapshot", payload)
        self.assertIn("sectionHashes", payload)

    def test_real_send_requires_explicit_configuration(self) -> None:
        result = send_audit_anchor(make_anchor_request(), mode="real-send", env={})

        self.assertEqual(result["status"], "CONFIGURATION_REQUIRED")
        self.assertEqual(result["network"], "testnet")
        self.assertEqual(result["error"]["kind"], "MISSING_CONFIGURATION")
        self.assertEqual(
            result["error"]["missingEnvVars"],
            [
                "COLDREAD_AUDIT_ANCHOR_RPC_URL",
                "COLDREAD_AUDIT_ANCHOR_PRIVATE_KEY",
                "COLDREAD_AUDIT_ANCHOR_CONTRACT_ADDRESS",
                "COLDREAD_AUDIT_ANCHOR_NETWORK",
            ],
        )

    def test_cli_can_emit_dry_run_metadata_from_stdin(self) -> None:
        result = subprocess.run(
            [
                sys.executable,
                "agents/audit_anchor_sender.py",
                "--input-file",
                "-",
                "--mode",
                "dry-run",
            ],
            cwd=PROJECT_ROOT,
            input=json.dumps(make_anchor_request()),
            capture_output=True,
            check=True,
            text=True,
        )

        metadata = json.loads(result.stdout)
        self.assertEqual(metadata["status"], "DRY_RUN")
        self.assertEqual(metadata["network"], "testnet")
        self.assertNotIn("transactionHash", metadata)


if __name__ == "__main__":
    unittest.main()
