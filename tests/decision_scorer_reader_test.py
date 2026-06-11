import json
import subprocess
import sys
import unittest
from copy import deepcopy
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from agents.decision_scorer import (
    build_decision_scorer_llm_request,
    generate_decision_scoring_draft,
    load_decision_scoring_input,
)


def make_scoring_input() -> dict:
    return {
        "evidenceSnapshot": {
            "id": "snapshot_1",
            "decisionRunId": "run_1",
            "createdAt": "2026-06-10T00:04:00.000Z",
            "marketEvidence": {
                "screenedMarkets": [
                    {
                        "id": "screened_candidate_poly_1",
                        "sourceCandidateMarketId": "candidate_poly_1",
                        "polymarketId": "poly_1",
                        "question": "Will the Fed cut rates in July?",
                        "outcomes": ["YES", "NO"],
                        "prices": {"yes": 0.92, "no": 0.08},
                        "volume": 100000,
                        "liquidity": 25000,
                        "closeTime": "2026-07-10T00:00:00.000Z",
                        "resolutionRules": "Resolves YES if the Fed cuts rates in July.",
                        "oneSidedSignal": {
                            "side": "YES",
                            "price": 0.92,
                            "rationale": "YES price is strongly one-sided.",
                        },
                        "confirmationRationale": "Tavily context found no major counterevidence.",
                    }
                ]
            },
            "contextEvidence": {
                "items": [
                    {
                        "id": "context_1",
                        "marketId": "candidate_poly_1",
                        "sourceUrl": "https://example.com/fed-context",
                        "title": "Fed rate context",
                        "summary": "No major contrary evidence found.",
                        "retrievedAt": "2026-06-10T00:03:00.000Z",
                    }
                ]
            },
        },
        "agentRecommendations": [
            {
                "id": "rec_market_structure_1",
                "decisionRunId": "run_1",
                "evidenceSnapshotId": "snapshot_1",
                "analysisLens": "MARKET_STRUCTURE",
                "action": "BUY_YES_SMALL",
                "targetMarketId": "screened_candidate_poly_1",
                "walletActionProposal": {
                    "id": "wallet_action_market_structure_1",
                    "marketId": "screened_candidate_poly_1",
                    "action": "BUY_YES_SMALL",
                    "stake": {"amount": "5.00", "currency": "USDC"},
                    "rationale": "Market structure supports a small YES position.",
                },
                "rationale": "Market structure supports a small YES position.",
                "confidence": "MEDIUM",
                "riskLevel": "LOW",
                "evidenceRefs": ["screened_candidate_poly_1"],
                "createdAt": "2026-06-10T00:05:00.000Z",
            },
            {
                "id": "rec_external_risk_1",
                "decisionRunId": "run_1",
                "evidenceSnapshotId": "snapshot_1",
                "analysisLens": "EXTERNAL_RISK",
                "action": "BUY_YES_SMALL",
                "targetMarketId": "screened_candidate_poly_1",
                "walletActionProposal": {
                    "id": "wallet_action_external_risk_1",
                    "marketId": "screened_candidate_poly_1",
                    "action": "BUY_YES_SMALL",
                    "stake": {"amount": "5.00", "currency": "USDC"},
                    "rationale": "External context does not undermine the YES signal.",
                },
                "rationale": "External context does not undermine the YES signal.",
                "confidence": "HIGH",
                "riskLevel": "LOW",
                "evidenceRefs": ["context_1"],
                "createdAt": "2026-06-10T00:05:00.000Z",
            },
        ],
        "scoringOptions": {},
    }


class DecisionScorerReaderTest(unittest.TestCase):
    def test_generates_normal_selection_draft_without_mutating_recommendations(self) -> None:
        scoring_input = make_scoring_input()
        original_recommendations = deepcopy(scoring_input["agentRecommendations"])

        draft = generate_decision_scoring_draft(scoring_input)

        self.assertEqual(draft["selectedRecommendationId"], "rec_external_risk_1")
        self.assertEqual(draft["vetoConditions"], [])
        self.assertIn("scoreMetadata", draft)
        self.assertNotIn("walletActionProposal", draft)
        self.assertEqual(scoring_input["agentRecommendations"], original_recommendations)

    def test_builds_llm_request_from_scoring_input(self) -> None:
        scoring_input = make_scoring_input()

        llm_request = build_decision_scorer_llm_request(scoring_input)

        self.assertEqual(llm_request["version"], "decision_scorer.v1")
        self.assertEqual(llm_request["input"]["snapshotId"], "snapshot_1")
        self.assertEqual(
            llm_request["requiredOutput"]["selectedRecommendationId"],
            "string or null",
        )
        self.assertIn("Decision Scorer", llm_request["messages"][0]["content"])

    def test_detects_weak_convergence_between_buy_recommendations(self) -> None:
        scoring_input = make_scoring_input()
        scoring_input["agentRecommendations"][1]["action"] = "BUY_NO_SMALL"
        scoring_input["agentRecommendations"][1]["walletActionProposal"]["action"] = (
            "BUY_NO_SMALL"
        )

        draft = generate_decision_scoring_draft(scoring_input)

        self.assertNotIn("selectedRecommendationId", draft)
        self.assertEqual(draft["vetoConditions"], ["WEAK_AGENT_CONVERGENCE"])

    def test_detects_major_external_counterevidence(self) -> None:
        scoring_input = make_scoring_input()
        scoring_input["agentRecommendations"][1]["riskLevel"] = "HIGH"

        draft = generate_decision_scoring_draft(scoring_input)

        self.assertNotIn("selectedRecommendationId", draft)
        self.assertEqual(
            draft["vetoConditions"],
            ["MAJOR_EXTERNAL_COUNTEREVIDENCE"],
        )

    def test_detects_missing_evidence_citations(self) -> None:
        scoring_input = make_scoring_input()
        scoring_input["agentRecommendations"][0]["evidenceRefs"] = []

        draft = generate_decision_scoring_draft(scoring_input)

        self.assertNotIn("selectedRecommendationId", draft)
        self.assertEqual(draft["vetoConditions"], ["MISSING_EVIDENCE_CITATIONS"])

    def test_cli_can_emit_a_draft_from_stdin(self) -> None:
        result = subprocess.run(
            [
                sys.executable,
                "agents/decision_scorer.py",
                "--input-file",
                "-",
            ],
            cwd=PROJECT_ROOT,
            input=json.dumps(make_scoring_input()),
            capture_output=True,
            check=True,
            text=True,
        )

        draft = json.loads(result.stdout)
        self.assertEqual(draft["selectedRecommendationId"], "rec_external_risk_1")
        self.assertEqual(draft["vetoConditions"], [])
        self.assertNotIn("walletActionProposal", draft)


if __name__ == "__main__":
    unittest.main()
