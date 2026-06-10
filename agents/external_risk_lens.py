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


def build_external_risk_llm_request(
    evidence_snapshot: dict[str, Any],
) -> dict[str, Any]:
    context_items = evidence_snapshot["contextEvidence"]["items"]

    llm_input = {
        "snapshotId": evidence_snapshot["id"],
        "decisionRunId": evidence_snapshot["decisionRunId"],
        "snapshotCreatedAt": evidence_snapshot["createdAt"],
        "markets": evidence_snapshot["marketEvidence"]["screenedMarkets"],
        "contextEvidence": context_items,
    }
    required_output = {
        "action": "BUY_YES_SMALL | BUY_NO_SMALL | HOLD",
        "targetMarketId": "string or null",
        "rationale": "string",
        "confidence": "LOW | MEDIUM | HIGH",
        "riskLevel": "LOW | MEDIUM | HIGH",
        "evidenceRefs": ["context evidence ids used"],
        "externalRiskFlags": [
            "MAJOR_COUNTEREVIDENCE | REVERSAL_RISK | LATE_BREAKING_EVENT | RESOLUTION_DISPUTE_RISK | UNCLEAR_CONTEXT"
        ],
    }

    return {
        "version": "external_risk_lens.v1",
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are the ColdRead External Risk Lens. Read only the provided "
                    "Evidence Snapshot context evidence. Return one JSON draft and do "
                    "not fetch news, Tavily, Polymarket, or any fresh evidence."
                ),
            },
            {
                "role": "user",
                "content": json.dumps(
                    {
                        "task": "Generate one External Risk Lens recommendation draft.",
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


def generate_external_risk_draft(
    evidence_snapshot: dict[str, Any],
) -> dict[str, Any]:
    markets = evidence_snapshot["marketEvidence"]["screenedMarkets"]
    context_items = evidence_snapshot["contextEvidence"]["items"]

    context_by_market = _group_context_by_market(context_items)
    hold_evidence_refs: list[str] = []
    hold_flags: list[str] = []

    for market in markets:
        market_context = _context_for_market(context_by_market, market)
        market_context_ids = [item["id"] for item in market_context]
        flags = _external_risk_flags(market_context)

        if not market_context:
            hold_evidence_refs.extend(market_context_ids)
            _append_unique(hold_flags, "UNCLEAR_CONTEXT")
            continue

        if flags:
            hold_evidence_refs.extend(market_context_ids)
            for flag in flags:
                _append_unique(hold_flags, flag)
            continue

        signal = market["oneSidedSignal"]
        action = "BUY_YES_SMALL" if signal["side"] == "YES" else "BUY_NO_SMALL"
        side_label = signal["side"]

        return {
            "action": action,
            "targetMarketId": market["id"],
            "rationale": (
                f"External context does not undermine the one-sided {side_label} signal: "
                f"{len(market_context)} context item(s) cite no major counterevidence, "
                f"reversal risk, late-breaking event, or resolution dispute."
            ),
            "confidence": "MEDIUM",
            "riskLevel": "LOW",
            "evidenceRefs": market_context_ids,
            "externalRiskFlags": [],
        }

    if not hold_evidence_refs:
        hold_evidence_refs = [item["id"] for item in context_items]

    return {
        "action": "HOLD",
        "rationale": (
            "External context is not clean enough to support a small position: "
            f"{', '.join(hold_flags) if hold_flags else 'UNCLEAR_CONTEXT'}."
        ),
        "confidence": "LOW",
        "riskLevel": "HIGH",
        "evidenceRefs": _unique(hold_evidence_refs),
        "externalRiskFlags": hold_flags or ["UNCLEAR_CONTEXT"],
    }


def _group_context_by_market(
    context_items: list[dict[str, Any]],
) -> dict[str, list[dict[str, Any]]]:
    grouped: dict[str, list[dict[str, Any]]] = {}
    for item in context_items:
        grouped.setdefault(item["marketId"], []).append(item)
    return grouped


def _context_for_market(
    context_by_market: dict[str, list[dict[str, Any]]],
    market: dict[str, Any],
) -> list[dict[str, Any]]:
    context_items: list[dict[str, Any]] = []
    for market_id in _context_market_ids(market):
        context_items.extend(context_by_market.get(market_id, []))
    return context_items


def _context_market_ids(market: dict[str, Any]) -> list[str]:
    market_ids = [market["id"]]
    source_candidate_market_id = market.get("sourceCandidateMarketId")
    if isinstance(source_candidate_market_id, str):
        market_ids.append(source_candidate_market_id)
    return _unique(market_ids)


def _external_risk_flags(context_items: list[dict[str, Any]]) -> list[str]:
    flags: list[str] = []
    for item in context_items:
        text = f"{item.get('title', '')} {item.get('summary', '')}".lower()
        if _has_non_negated_counterevidence(text):
            _append_unique(flags, "MAJOR_COUNTEREVIDENCE")
        if any(term in text for term in ["reversal risk", "could reverse", "reversal"]):
            _append_unique(flags, "REVERSAL_RISK")
        if any(term in text for term in ["late-breaking", "late breaking", "breaking"]):
            _append_unique(flags, "LATE_BREAKING_EVENT")
        if any(term in text for term in ["dispute", "ambiguous resolution", "resolution risk"]):
            _append_unique(flags, "RESOLUTION_DISPUTE_RISK")
        if any(term in text for term in ["unclear", "insufficient context", "unknown"]):
            _append_unique(flags, "UNCLEAR_CONTEXT")
    return flags


def _has_non_negated_counterevidence(text: str) -> bool:
    negated_phrases = [
        "no major counterevidence",
        "no counterevidence",
        "no major contrary",
        "no contrary evidence",
        "does not undermine",
        "not undermine",
    ]
    if any(phrase in text for phrase in negated_phrases):
        return False

    return any(term in text for term in ["counterevidence", "contrary", "undermine"])


def _append_unique(items: list[str], item: str) -> None:
    if item not in items:
        items.append(item)


def _unique(items: list[str]) -> list[str]:
    unique_items: list[str] = []
    for item in items:
        _append_unique(unique_items, item)
    return unique_items


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the ColdRead External Risk Lens.")
    parser.add_argument("--snapshot-file", required=True)
    parser.add_argument(
        "--mode",
        choices=["draft", "llm-request"],
        default="draft",
    )
    args = parser.parse_args()

    snapshot = load_evidence_snapshot(args.snapshot_file)
    if args.mode == "llm-request":
        output = build_external_risk_llm_request(snapshot)
    else:
        output = generate_external_risk_draft(snapshot)

    print(json.dumps(output, ensure_ascii=False))


if __name__ == "__main__":
    main()
