from __future__ import annotations

"""ColdRead Decision Scorer draft engine.

Input JSON shape:
{
  "evidenceSnapshot": EvidenceSnapshot,
  "agentRecommendations": AgentRecommendation[],
  "scoringOptions": object
}

Output draft shape, consumed by the TypeScript scorer adapter:
{
  "selectedRecommendationId": "rec_..." | omitted when vetoed,
  "rationale": "string",
  "vetoConditions": VetoCondition[],
  "scoreMetadata": [
    {"recommendationId": "rec_...", "score": number, "reasons": string[]}
  ]
}

This module must not create FinalDecision objects, mutate recommendations, or emit
walletActionProposal fields.
"""

import argparse
import json
import sys
from copy import deepcopy
from pathlib import Path
from typing import Any


def load_decision_scoring_input(input_file: str) -> dict[str, Any]:
    if input_file == "-":
        raw_input = sys.stdin.read()
    else:
        raw_input = Path(input_file).read_text(encoding="utf-8")

    scoring_input = json.loads(raw_input)
    if not isinstance(scoring_input, dict):
        raise ValueError("Decision Scorer input must be a JSON object.")

    return scoring_input


def build_decision_scorer_llm_request(
    scoring_input: dict[str, Any],
) -> dict[str, Any]:
    evidence_snapshot = scoring_input["evidenceSnapshot"]
    agent_recommendations = scoring_input["agentRecommendations"]
    scoring_options = scoring_input.get("scoringOptions", {})

    llm_input = {
        "snapshotId": evidence_snapshot["id"],
        "decisionRunId": evidence_snapshot["decisionRunId"],
        "snapshotCreatedAt": evidence_snapshot["createdAt"],
        "agentRecommendations": agent_recommendations,
        "scoringOptions": scoring_options,
    }
    required_output = {
        "selectedRecommendationId": "string or null",
        "rationale": "string",
        "vetoConditions": [
            "UNCLEAR_RESOLUTION_RULES | INSUFFICIENT_LIQUIDITY | TOO_NEAR_RESOLUTION | MAJOR_EXTERNAL_COUNTEREVIDENCE | INCOMPLETE_EVIDENCE_SNAPSHOT | MISSING_EVIDENCE_CITATIONS | WEAK_AGENT_CONVERGENCE"
        ],
        "scoreMetadata": [
            {
                "recommendationId": "string",
                "score": "number",
                "reasons": ["string"],
            }
        ],
    }

    return {
        "version": "decision_scorer.v1",
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are the ColdRead Decision Scorer. Compare only the provided "
                    "Evidence Snapshot and Agent Recommendations. Return selection "
                    "metadata only; never create Final Decisions or wallet actions."
                ),
            },
            {
                "role": "user",
                "content": json.dumps(
                    {
                        "task": "Generate one Decision Scorer ranking draft.",
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


def generate_decision_scoring_draft(
    scoring_input: dict[str, Any],
) -> dict[str, Any]:
    agent_recommendations = deepcopy(scoring_input["agentRecommendations"])
    veto_conditions = _detect_veto_conditions(scoring_input, agent_recommendations)
    score_metadata = [
        _score_recommendation(recommendation)
        for recommendation in agent_recommendations
    ]

    if veto_conditions:
        return {
            "rationale": (
                "Decision Scorer detected veto conditions and recommends HOLD: "
                f"{', '.join(veto_conditions)}."
            ),
            "vetoConditions": veto_conditions,
            "scoreMetadata": score_metadata,
        }

    selected = max(score_metadata, key=lambda item: item["score"])
    return {
        "selectedRecommendationId": selected["recommendationId"],
        "rationale": (
            f"Selected {selected['recommendationId']} because it has the strongest "
            "non-vetoed recommendation profile."
        ),
        "vetoConditions": [],
        "scoreMetadata": score_metadata,
    }


def _detect_veto_conditions(
    scoring_input: dict[str, Any],
    agent_recommendations: list[dict[str, Any]],
) -> list[str]:
    veto_conditions: list[str] = []

    if not scoring_input["evidenceSnapshot"]["marketEvidence"]["screenedMarkets"]:
        _append_unique(veto_conditions, "INCOMPLETE_EVIDENCE_SNAPSHOT")

    for recommendation in agent_recommendations:
        if not recommendation.get("evidenceRefs"):
            _append_unique(veto_conditions, "MISSING_EVIDENCE_CITATIONS")
        if (
            recommendation.get("analysisLens") == "EXTERNAL_RISK"
            and recommendation.get("riskLevel") == "HIGH"
        ):
            _append_unique(veto_conditions, "MAJOR_EXTERNAL_COUNTEREVIDENCE")

    buy_recommendations = [
        recommendation
        for recommendation in agent_recommendations
        if recommendation.get("action") != "HOLD"
    ]
    if len(buy_recommendations) >= 2:
        actions = {recommendation.get("action") for recommendation in buy_recommendations}
        targets = {
            recommendation.get("targetMarketId")
            for recommendation in buy_recommendations
        }
        if len(actions) > 1 or len(targets) > 1:
            _append_unique(veto_conditions, "WEAK_AGENT_CONVERGENCE")

    return veto_conditions


def _score_recommendation(recommendation: dict[str, Any]) -> dict[str, Any]:
    score = _action_score(recommendation) + _confidence_score(
        recommendation["confidence"]
    ) - _risk_penalty(recommendation["riskLevel"])
    reasons = [
        f"action={recommendation['action']}",
        f"confidence={recommendation['confidence']}",
        f"riskLevel={recommendation['riskLevel']}",
    ]
    return {
        "recommendationId": recommendation["id"],
        "score": score,
        "reasons": reasons,
    }


def _action_score(recommendation: dict[str, Any]) -> int:
    return 0 if recommendation["action"] == "HOLD" else 10


def _confidence_score(confidence: str) -> int:
    if confidence == "HIGH":
        return 3
    if confidence == "MEDIUM":
        return 2
    return 1


def _risk_penalty(risk_level: str) -> int:
    if risk_level == "HIGH":
        return 3
    if risk_level == "MEDIUM":
        return 1
    return 0


def _append_unique(items: list[str], item: str) -> None:
    if item not in items:
        items.append(item)


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the ColdRead Decision Scorer.")
    parser.add_argument("--input-file", required=True)
    parser.add_argument(
        "--mode",
        choices=["draft", "llm-request"],
        default="draft",
    )
    args = parser.parse_args()

    scoring_input = load_decision_scoring_input(args.input_file)
    if args.mode == "llm-request":
        output = build_decision_scorer_llm_request(scoring_input)
    else:
        output = generate_decision_scoring_draft(scoring_input)

    print(json.dumps(output, ensure_ascii=False))


if __name__ == "__main__":
    main()
