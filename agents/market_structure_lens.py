from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any


def load_evidence_snapshot(snapshot_file: str) -> dict[str, Any]:
    if snapshot_file == "-":
        raw_snapshot = sys.stdin.read()
    else:
        raw_snapshot = Path(snapshot_file).read_text(encoding="utf-8")

    snapshot = json.loads(raw_snapshot)
    if not isinstance(snapshot, dict):
        raise ValueError("Evidence Snapshot must be a JSON object.")

    return snapshot


def build_market_structure_llm_request(
    evidence_snapshot: dict[str, Any],
) -> dict[str, Any]:
    markets = evidence_snapshot["marketEvidence"]["screenedMarkets"]

    llm_input = {
        "snapshotId": evidence_snapshot["id"],
        "decisionRunId": evidence_snapshot["decisionRunId"],
        "snapshotCreatedAt": evidence_snapshot["createdAt"],
        "markets": markets,
    }
    required_output = {
        "action": "BUY_YES_SMALL | BUY_NO_SMALL | HOLD",
        "targetMarketId": "string or null",
        "rationale": "string",
        "confidence": "LOW | MEDIUM | HIGH",
        "riskLevel": "LOW | MEDIUM | HIGH",
        "evidenceRefs": ["screened market ids used"],
    }

    return {
        "version": "market_structure_lens.v1",
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are the ColdRead Market Structure Lens. Read only the provided "
                    "Evidence Snapshot market evidence. Return one JSON draft and do not "
                    "fetch or assume fresh evidence."
                ),
            },
            {
                "role": "user",
                "content": json.dumps(
                    {
                        "task": "Generate one Market Structure Lens recommendation draft.",
                        "input": llm_input,
                        "requiredOutput": required_output,
                    },
                    ensure_ascii=False,
                    sort_keys=True,
                ),
            },
        ],
        "input": llm_input,
        "requiredOutput": required_output,
    }


DEFAULT_MIN_LIQUIDITY = 1000
DEFAULT_MIN_VOLUME = 1000


def generate_market_structure_draft(
    evidence_snapshot: dict[str, Any],
    min_liquidity: float = DEFAULT_MIN_LIQUIDITY,
    min_volume: float = DEFAULT_MIN_VOLUME,
) -> dict[str, Any]:
    markets = evidence_snapshot["marketEvidence"]["screenedMarkets"]

    for market in markets:
        if not _market_structure_is_too_weak(market, min_liquidity, min_volume):
            signal = market["oneSidedSignal"]
            action = "BUY_YES_SMALL" if signal["side"] == "YES" else "BUY_NO_SMALL"
            side_price = (
                market["prices"]["yes"]
                if signal["side"] == "YES"
                else market["prices"]["no"]
            )
            side_label = signal["side"]

            return {
                "action": action,
                "targetMarketId": market["id"],
                "rationale": (
                    f"Market structure favors a small {side_label} position: "
                    f"{side_label} price {side_price} is one-sided, liquidity {market['liquidity']} "
                    f"and volume {market['volume']} support a fixed small stake, and resolution rules are present."
                ),
                "confidence": "MEDIUM",
                "riskLevel": "LOW",
                "evidenceRefs": [market["id"]],
            }

    all_market_ids = [m["id"] for m in markets]
    weak_reasons = "; ".join(
        f"{m['id']} liquidity {m['liquidity']} volume {m['volume']}"
        for m in markets
    )
    return {
        "action": "HOLD",
        "rationale": (
            f"No ScreenedMarket passes structure thresholds "
            f"(min_liquidity={min_liquidity}, min_volume={min_volume}): "
            f"{weak_reasons}"
        ),
        "confidence": "LOW",
        "riskLevel": "HIGH",
        "evidenceRefs": all_market_ids,
    }


def _market_structure_is_too_weak(
    market: dict[str, Any],
    min_liquidity: float = DEFAULT_MIN_LIQUIDITY,
    min_volume: float = DEFAULT_MIN_VOLUME,
) -> bool:
    return market["liquidity"] < min_liquidity or market["volume"] < min_volume


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the ColdRead Market Structure Lens.")
    parser.add_argument("--snapshot-file", required=True)
    parser.add_argument(
        "--mode",
        choices=["draft", "llm-request"],
        default="draft",
    )
    parser.add_argument(
        "--min-liquidity",
        type=float,
        default=DEFAULT_MIN_LIQUIDITY,
        help=f"Minimum liquidity threshold (default: {DEFAULT_MIN_LIQUIDITY})",
    )
    parser.add_argument(
        "--min-volume",
        type=float,
        default=DEFAULT_MIN_VOLUME,
        help=f"Minimum volume threshold (default: {DEFAULT_MIN_VOLUME})",
    )
    args = parser.parse_args()

    snapshot = load_evidence_snapshot(args.snapshot_file)
    if args.mode == "llm-request":
        output = build_market_structure_llm_request(snapshot)
    else:
        output = generate_market_structure_draft(
            snapshot,
            min_liquidity=args.min_liquidity,
            min_volume=args.min_volume,
        )

    print(json.dumps(output, ensure_ascii=False))


if __name__ == "__main__":
    main()
