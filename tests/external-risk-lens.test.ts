import assert from "node:assert/strict";
import test from "node:test";

import {
  adaptExternalRiskDraft,
  confirmScreenedMarketsWithTavily,
  freezeEvidenceSnapshot,
  generateExternalRiskDraftWithPython,
  generateExternalRiskRecommendationWithPython,
  type CandidateMarket,
  type CandidateMarketScreeningResult,
  type DecisionTopic,
  type EvidenceSnapshot,
  type ExternalRiskRecommendationDraft,
} from "../src/index.js";
import { timelineEntries } from "./helpers.js";

const evidenceSnapshot: EvidenceSnapshot = {
  id: "snapshot_1",
  decisionRunId: "run_1",
  createdAt: "2026-06-10T00:04:00.000Z",
  marketEvidence: {
    screenedMarkets: [
      {
        id: "screened_candidate_poly_1",
        sourceCandidateMarketId: "candidate_poly_1",
        polymarketId: "poly_1",
        question: "Will the Fed cut rates in July?",
        outcomes: ["YES", "NO"],
        prices: {
          yes: 0.92,
          no: 0.08,
        },
        volume: 100000,
        liquidity: 25000,
        closeTime: "2026-07-10T00:00:00.000Z",
        resolutionRules: "Resolves YES if the Fed cuts rates in July.",
        oneSidedSignal: {
          side: "YES",
          price: 0.92,
          rationale: "YES price is strongly one-sided.",
        },
        confirmationRationale: "Tavily context found no major counterevidence.",
      },
    ],
  },
  contextEvidence: {
    items: [
      {
        id: "context_1",
        marketId: "screened_candidate_poly_1",
        sourceUrl: "https://example.com/fed-context",
        title: "Fed rate context",
        summary: "No major contrary evidence found.",
        retrievedAt: "2026-06-10T00:03:00.000Z",
      },
    ],
  },
};

const candidateMarket: CandidateMarket = {
  id: "candidate_poly_1",
  sourceMarketId: "poly_1",
  question: "Will the Fed cut rates in July?",
  outcomes: ["YES", "NO"],
  prices: {
    yes: 0.92,
    no: 0.08,
  },
  volume: 100000,
  liquidity: 25000,
  closeTime: "2026-07-10T00:00:00.000Z",
  resolutionRules: "Resolves YES if the Fed cuts rates in July.",
  oneSidedSignal: {
    side: "YES",
    price: 0.92,
    rationale: "YES price is strongly one-sided.",
  },
  screeningRationale: "Polymarket-only hard gates passed.",
};

const candidateMarketScreeningResult: CandidateMarketScreeningResult = {
  kind: "candidate_markets_screened",
  topicId: "topic_fed_rates",
  screenedAt: "2026-06-10T00:02:00.000Z",
  candidateMarkets: [candidateMarket],
  rejectedMarkets: [],
  timeline: timelineEntries([
    "topic_received",
    "markets_fetched",
    "candidate_markets_screened",
  ]),
};

const topic: DecisionTopic = {
  id: "topic_fed_rates",
  text: "Fed rate cut",
  submittedBy: "user_1",
  receivedAt: "2026-06-10T00:00:00.000Z",
};

test("adapts a low-risk Python External Risk BUY_YES draft into a domain Agent Recommendation", () => {
  const draft: ExternalRiskRecommendationDraft = {
    action: "BUY_YES_SMALL",
    targetMarketId: "screened_candidate_poly_1",
    rationale: "External context does not undermine the one-sided YES signal.",
    confidence: "MEDIUM",
    riskLevel: "LOW",
    evidenceRefs: ["context_1"],
    externalRiskFlags: [],
  };

  const recommendation = adaptExternalRiskDraft({
    evidenceSnapshot,
    draft,
    now: "2026-06-10T00:05:00.000Z",
    createRecommendationId: () => "rec_external_risk_1",
    createWalletActionProposalId: () => "wallet_action_external_1",
    smallStakeAmount: "5.00",
  });

  assert.deepEqual(recommendation, {
    id: "rec_external_risk_1",
    decisionRunId: "run_1",
    evidenceSnapshotId: "snapshot_1",
    analysisLens: "EXTERNAL_RISK",
    action: "BUY_YES_SMALL",
    targetMarketId: "screened_candidate_poly_1",
    walletActionProposal: {
      id: "wallet_action_external_1",
      marketId: "screened_candidate_poly_1",
      action: "BUY_YES_SMALL",
      stake: {
        amount: "5.00",
        currency: "USDC",
      },
      rationale: "External context does not undermine the one-sided YES signal.",
    },
    rationale: "External context does not undermine the one-sided YES signal.",
    confidence: "MEDIUM",
    riskLevel: "LOW",
    evidenceRefs: ["context_1"],
    createdAt: "2026-06-10T00:05:00.000Z",
  });
});

test("adapts a low-risk Python External Risk BUY_NO draft into a buy recommendation", () => {
  const recommendation = adaptExternalRiskDraft({
    evidenceSnapshot,
    draft: {
      action: "BUY_NO_SMALL",
      targetMarketId: "screened_candidate_poly_1",
      rationale: "External context does not undermine the one-sided NO signal.",
      confidence: "MEDIUM",
      riskLevel: "MEDIUM",
      evidenceRefs: ["context_1"],
      externalRiskFlags: [],
    },
    now: "2026-06-10T00:05:00.000Z",
    createRecommendationId: () => "rec_external_risk_no_1",
    createWalletActionProposalId: () => "wallet_action_external_no_1",
    smallStakeAmount: "5.00",
  });

  assert.equal(recommendation.action, "BUY_NO_SMALL");
  assert.equal(recommendation.targetMarketId, "screened_candidate_poly_1");
  assert.deepEqual(recommendation.walletActionProposal, {
    id: "wallet_action_external_no_1",
    marketId: "screened_candidate_poly_1",
    action: "BUY_NO_SMALL",
    stake: {
      amount: "5.00",
      currency: "USDC",
    },
    rationale: "External context does not undermine the one-sided NO signal.",
  });
});


test("enforces HOLD when a Python External Risk draft reports material counterevidence", () => {
  const recommendation = adaptExternalRiskDraft({
    evidenceSnapshot,
    draft: {
      action: "BUY_YES_SMALL",
      targetMarketId: "screened_candidate_poly_1",
      rationale: "Major counterevidence undermines the one-sided signal.",
      confidence: "LOW",
      riskLevel: "HIGH",
      evidenceRefs: ["context_1"],
      externalRiskFlags: ["MAJOR_COUNTEREVIDENCE"],
    },
    now: "2026-06-10T00:05:00.000Z",
    createRecommendationId: () => "rec_external_risk_2",
    createWalletActionProposalId: () => "wallet_action_external_2",
    smallStakeAmount: "5.00",
  });

  assert.deepEqual(recommendation, {
    id: "rec_external_risk_2",
    decisionRunId: "run_1",
    evidenceSnapshotId: "snapshot_1",
    analysisLens: "EXTERNAL_RISK",
    action: "HOLD",
    rationale: "Major counterevidence undermines the one-sided signal.",
    confidence: "LOW",
    riskLevel: "HIGH",
    evidenceRefs: ["context_1"],
    createdAt: "2026-06-10T00:05:00.000Z",
  });
});

test("enforces HOLD when a Python External Risk draft reports unclear context", () => {
  const recommendation = adaptExternalRiskDraft({
    evidenceSnapshot,
    draft: {
      action: "BUY_YES_SMALL",
      targetMarketId: "screened_candidate_poly_1",
      rationale: "Context is too unclear to support the one-sided signal.",
      confidence: "LOW",
      riskLevel: "HIGH",
      evidenceRefs: ["context_1"],
      externalRiskFlags: ["UNCLEAR_CONTEXT"],
    },
    now: "2026-06-10T00:05:00.000Z",
    createRecommendationId: () => "rec_external_risk_3",
    createWalletActionProposalId: () => "wallet_action_external_3",
    smallStakeAmount: "5.00",
  });

  assert.equal(recommendation.action, "HOLD");
  assert.equal("targetMarketId" in recommendation, false);
  assert.equal("walletActionProposal" in recommendation, false);
  assert.deepEqual(recommendation.evidenceRefs, ["context_1"]);
});

test("rejects malformed Python External Risk drafts before they become domain recommendations", () => {
  const baseInput = {
    evidenceSnapshot,
    now: "2026-06-10T00:05:00.000Z",
    createRecommendationId: () => "rec_external_risk_4",
    createWalletActionProposalId: () => "wallet_action_external_4",
    smallStakeAmount: "5.00",
  };

  assert.throws(
    () =>
      adaptExternalRiskDraft({
        ...baseInput,
        draft: {
          action: "BUY_YES_SMALL",
          rationale: "Buy draft must name a target market.",
          confidence: "MEDIUM",
          riskLevel: "LOW",
          evidenceRefs: ["context_1"],
          externalRiskFlags: [],
        },
      }),
    /Buy recommendations require a target market\./,
  );
  assert.throws(
    () =>
      adaptExternalRiskDraft({
        ...baseInput,
        draft: {
          action: "HOLD",
          targetMarketId: "screened_candidate_poly_1",
          rationale: "Hold draft cannot target a market.",
          confidence: "LOW",
          riskLevel: "HIGH",
          evidenceRefs: ["context_1"],
          externalRiskFlags: [],
        },
      }),
    /HOLD recommendations cannot target a market\./,
  );
  assert.throws(
    () =>
      adaptExternalRiskDraft({
        ...baseInput,
        draft: {
          action: "BUY_YES_SMALL",
          targetMarketId: "screened_candidate_poly_1",
          rationale: "Evidence refs must cite context evidence.",
          confidence: "MEDIUM",
          riskLevel: "LOW",
          evidenceRefs: ["screened_candidate_poly_1"],
          externalRiskFlags: [],
        },
      }),
    /External Risk evidenceRefs must reference snapshot context evidence\./,
  );
  assert.throws(
    () =>
      adaptExternalRiskDraft({
        ...baseInput,
        draft: {
          action: "BUY_MAYBE_LARGE",
          targetMarketId: "screened_candidate_poly_1",
          rationale: "Python drafts cannot invent actions.",
          confidence: "MEDIUM",
          riskLevel: "LOW",
          evidenceRefs: ["context_1"],
          externalRiskFlags: [],
        } as unknown as ExternalRiskRecommendationDraft,
      }),
    /Unsupported External Risk action\./,
  );
});

test("runs the Python External Risk Lens over an Evidence Snapshot and returns a draft", async () => {
  const draft = await generateExternalRiskDraftWithPython({
    evidenceSnapshot,
  });

  assert.deepEqual(draft, {
    action: "BUY_YES_SMALL",
    targetMarketId: "screened_candidate_poly_1",
    rationale:
      "External context does not undermine the one-sided YES signal: 1 context item(s) cite no major counterevidence, reversal risk, late-breaking event, or resolution dispute.",
    confidence: "MEDIUM",
    riskLevel: "LOW",
    evidenceRefs: ["context_1"],
    externalRiskFlags: [],
  });
});

test("runs the Python External Risk Lens over a frozen Tavily-confirmed Evidence Snapshot", async () => {
  const tavilyResult = await confirmScreenedMarketsWithTavily({
    candidateMarketScreeningResult,
    now: "2026-06-10T00:03:00.000Z",
    createDecisionRunId: () => "run_1",
    queryTavily: async () => [
      {
        url: "https://example.com/fed-context",
        title: "Fed rate context",
        summary: "No major contrary evidence found.",
      },
    ],
  });
  assert.equal(tavilyResult.kind, "high_conviction_markets_confirmed");

  const frozen = freezeEvidenceSnapshot({
    topic,
    highConvictionMarketsConfirmed: tavilyResult,
    now: "2026-06-10T00:04:00.000Z",
    createEvidenceSnapshotId: () => "snapshot_1",
    createDecisionDossierDraftId: () => "dossier_1",
  });

  const draft = await generateExternalRiskDraftWithPython({
    evidenceSnapshot: frozen.evidenceSnapshot,
  });

  assert.deepEqual(draft, {
    action: "BUY_YES_SMALL",
    targetMarketId: "screened_candidate_poly_1",
    rationale:
      "External context does not undermine the one-sided YES signal: 1 context item(s) cite no major counterevidence, reversal risk, late-breaking event, or resolution dispute.",
    confidence: "MEDIUM",
    riskLevel: "LOW",
    evidenceRefs: ["context_candidate_poly_1_1"],
    externalRiskFlags: [],
  });
});

test("runs the Python External Risk Lens using explicit Screened Market source identity", async () => {
  const explicitSourceSnapshot: EvidenceSnapshot = {
    ...evidenceSnapshot,
    marketEvidence: {
      screenedMarkets: [
        {
          ...evidenceSnapshot.marketEvidence.screenedMarkets[0],
          id: "screened_market_1",
          sourceCandidateMarketId: "candidate_poly_1",
        },
      ],
    },
    contextEvidence: {
      items: [
        {
          id: "context_candidate_poly_1_1",
          marketId: "candidate_poly_1",
          sourceUrl: "https://example.com/fed-context",
          title: "Fed rate context",
          summary: "No major contrary evidence found.",
          retrievedAt: "2026-06-10T00:03:00.000Z",
        },
      ],
    },
  };

  const draft = await generateExternalRiskDraftWithPython({
    evidenceSnapshot: explicitSourceSnapshot,
  });

  assert.deepEqual(draft, {
    action: "BUY_YES_SMALL",
    targetMarketId: "screened_market_1",
    rationale:
      "External context does not undermine the one-sided YES signal: 1 context item(s) cite no major counterevidence, reversal risk, late-breaking event, or resolution dispute.",
    confidence: "MEDIUM",
    riskLevel: "LOW",
    evidenceRefs: ["context_candidate_poly_1_1"],
    externalRiskFlags: [],
  });
});

test("runs the Python External Risk Lens and returns HOLD when context is risky", async () => {
  const riskyContextSnapshot: EvidenceSnapshot = {
    ...evidenceSnapshot,
    contextEvidence: {
      items: [
        {
          id: "context_risky_1",
          marketId: "screened_candidate_poly_1",
          sourceUrl: "https://example.com/fed-risk",
          title: "Fed reversal risk",
          summary: "Late-breaking counterevidence could undermine the signal.",
          retrievedAt: "2026-06-10T00:03:00.000Z",
        },
      ],
    },
  };

  const draft = await generateExternalRiskDraftWithPython({
    evidenceSnapshot: riskyContextSnapshot,
  });

  assert.equal(draft.action, "HOLD");
  assert.equal("targetMarketId" in draft, false);
  assert.equal(draft.confidence, "LOW");
  assert.equal(draft.riskLevel, "HIGH");
  assert.deepEqual(draft.evidenceRefs, ["context_risky_1"]);
  assert.deepEqual(draft.externalRiskFlags, [
    "MAJOR_COUNTEREVIDENCE",
    "REVERSAL_RISK",
    "LATE_BREAKING_EVENT",
  ]);
});

test("runs the Python External Risk Lens and adapts its draft into a domain recommendation", async () => {
  const recommendation = await generateExternalRiskRecommendationWithPython({
    evidenceSnapshot,
    now: "2026-06-10T00:05:00.000Z",
    createRecommendationId: () => "rec_external_risk_python_1",
    createWalletActionProposalId: () => "wallet_action_external_python_1",
    smallStakeAmount: "5.00",
  });

  assert.deepEqual(recommendation, {
    id: "rec_external_risk_python_1",
    decisionRunId: "run_1",
    evidenceSnapshotId: "snapshot_1",
    analysisLens: "EXTERNAL_RISK",
    action: "BUY_YES_SMALL",
    targetMarketId: "screened_candidate_poly_1",
    walletActionProposal: {
      id: "wallet_action_external_python_1",
      marketId: "screened_candidate_poly_1",
      action: "BUY_YES_SMALL",
      stake: {
        amount: "5.00",
        currency: "USDC",
      },
      rationale:
        "External context does not undermine the one-sided YES signal: 1 context item(s) cite no major counterevidence, reversal risk, late-breaking event, or resolution dispute.",
    },
    rationale:
      "External context does not undermine the one-sided YES signal: 1 context item(s) cite no major counterevidence, reversal risk, late-breaking event, or resolution dispute.",
    confidence: "MEDIUM",
    riskLevel: "LOW",
    evidenceRefs: ["context_1"],
    createdAt: "2026-06-10T00:05:00.000Z",
  });
});
