from __future__ import annotations

"""ColdRead testnet Audit Anchor sender.

Input JSON shape:
{
  "version": "coldread.audit-anchor.v1",
  "network": "testnet",
  "decisionRunId": "run_...",
  "dossierId": "dossier_...",
  "contentHash": "sha256 hash",
  "hashAlgorithm": "sha256",
  "canonicalization": "coldread-json-v1",
  "sectionHashes": {
    "evidenceSnapshot": "hash",
    "agentRecommendations": "hash",
    "finalDecision": "hash",
    "executionRecord": "hash" // optional
  }
}

Dry-run mode requires no private key and returns JSON-compatible metadata.
Real-send mode is intentionally gated until HITL confirms:
target testnet, contract shape/address, deployment owner, RPC provider,
private key handling, and explorer URL format.

Required env vars for real-send mode:
- COLDREAD_AUDIT_ANCHOR_RPC_URL
- COLDREAD_AUDIT_ANCHOR_PRIVATE_KEY
- COLDREAD_AUDIT_ANCHOR_CONTRACT_ADDRESS
- COLDREAD_AUDIT_ANCHOR_NETWORK
"""

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any, Mapping


REQUIRED_REAL_SEND_ENV_VARS = [
    "COLDREAD_AUDIT_ANCHOR_RPC_URL",
    "COLDREAD_AUDIT_ANCHOR_PRIVATE_KEY",
    "COLDREAD_AUDIT_ANCHOR_CONTRACT_ADDRESS",
    "COLDREAD_AUDIT_ANCHOR_NETWORK",
]


def load_anchor_request(input_file: str) -> dict[str, Any]:
    if input_file == "-":
        raw_input = sys.stdin.read()
    else:
        raw_input = Path(input_file).read_text(encoding="utf-8")

    anchor_request = json.loads(raw_input)
    if not isinstance(anchor_request, dict):
        raise ValueError("Audit Anchor request must be a JSON object.")

    return anchor_request


def build_anchor_transaction_payload(
    anchor_request: dict[str, Any],
) -> dict[str, Any]:
    return {
        "version": anchor_request["version"],
        "network": anchor_request["network"],
        "decisionRunId": anchor_request["decisionRunId"],
        "dossierId": anchor_request["dossierId"],
        "contentHash": anchor_request["contentHash"],
        "hashAlgorithm": anchor_request["hashAlgorithm"],
        "canonicalization": anchor_request["canonicalization"],
        "sectionHashes": anchor_request["sectionHashes"],
    }


def send_audit_anchor(
    anchor_request: dict[str, Any],
    mode: str,
    env: Mapping[str, str] | None = None,
) -> dict[str, Any]:
    environment = os.environ if env is None else env
    payload = build_anchor_transaction_payload(anchor_request)

    if mode == "dry-run":
        return {
            "status": "DRY_RUN",
            "network": anchor_request["network"],
            "contentHash": anchor_request["contentHash"],
            "serializedPayload": json.dumps(payload, sort_keys=True),
        }

    if mode != "real-send":
        raise ValueError("Unsupported Audit Anchor sender mode.")

    missing_env = [
        env_var for env_var in REQUIRED_REAL_SEND_ENV_VARS if not environment.get(env_var)
    ]
    if missing_env:
        return {
            "status": "CONFIGURATION_REQUIRED",
            "network": anchor_request["network"],
            "error": {
                "kind": "MISSING_CONFIGURATION",
                "message": "Real-send mode requires confirmed testnet configuration.",
                "missingEnvVars": missing_env,
            },
        }

    return {
        "status": "CONFIGURATION_CONFIRMED_BUT_SENDER_NOT_IMPLEMENTED",
        "network": anchor_request["network"],
        "contractAddress": environment["COLDREAD_AUDIT_ANCHOR_CONTRACT_ADDRESS"],
        "error": {
            "kind": "REAL_SEND_NOT_IMPLEMENTED",
            "message": (
                "Real testnet sending is gated until the contract interface "
                "and provider flow are confirmed."
            ),
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the ColdRead Audit Anchor sender.")
    parser.add_argument("--input-file", required=True)
    parser.add_argument(
        "--mode",
        choices=["dry-run", "real-send"],
        default="dry-run",
    )
    args = parser.parse_args()

    anchor_request = load_anchor_request(args.input_file)
    output = send_audit_anchor(anchor_request, mode=args.mode)
    print(json.dumps(output, ensure_ascii=False))


if __name__ == "__main__":
    main()
