import {
  runDecisionPipeline,
  type CandidateMarket,
  type EvidenceSnapshot,
  type PipelineResult,
} from "./index.js";

export type MvpDecisionRunApiRequest = {
  topicText?: unknown;
  now?: string;
};

export type MvpDecisionRunApiResponse =
  | {
      status: 201;
      body: PipelineResult;
    }
  | {
      status: 400;
      body: {
        kind: "api_error";
        message: string;
      };
    };

export async function runMvpDecisionRunApi(
  request: MvpDecisionRunApiRequest,
): Promise<MvpDecisionRunApiResponse> {
  if (typeof request.topicText !== "string" || request.topicText.trim() === "") {
    return {
      status: 400,
      body: {
        kind: "api_error",
        message: "Decision Topic is required.",
      },
    };
  }

  let counter = 0;
  const nextId = (prefix: string) => () => `${prefix}_${++counter}`;
  const now = request.now ?? new Date().toISOString();
  const topicText = request.topicText.trim();

  const result = await runDecisionPipeline({
    topicText,
    now,
    fetchMarkets: async () =>
      topicText.toLowerCase().includes("no screened market")
        ? []
        : [
            {
              id: "poly_fed_cuts_july",
              question: "Will the Fed cut interest rates in July 2026?",
              outcomes: ["YES", "NO"],
              prices: { YES: 0.88, NO: 0.12 },
              status: "active",
              volume: 1_200_000,
              liquidity: 350_000,
              closeTime: "2026-07-10T00:00:00.000Z",
              resolutionRules:
                "Resolves YES if the Federal Reserve announces a rate cut at its July 2026 meeting.",
              raw: {},
            },
          ],
    queryTavily: async (_candidateMarket: CandidateMarket) => [
      {
        url: "https://example.com/fed-outlook",
        title: "Fed Rate Outlook",
        summary:
          "Market consensus expects a cut in July. No major counterevidence found.",
      },
    ],
    generateMarketStructureDraft: async (_snapshot: EvidenceSnapshot) => ({
      action: "BUY_YES_SMALL" as const,
      targetMarketId: "screened_candidate_poly_fed_cuts_july",
      rationale:
        "YES price 0.88 is strongly one-sided. Volume $1.2M and liquidity $350k support a small stake.",
      confidence: "MEDIUM" as const,
      riskLevel: "LOW" as const,
      evidenceRefs: ["screened_candidate_poly_fed_cuts_july"] as const,
    }),
    generateExternalRiskDraft: async (_snapshot: EvidenceSnapshot) => ({
      action: "BUY_YES_SMALL" as const,
      targetMarketId: "screened_candidate_poly_fed_cuts_july",
      rationale: "External context does not undermine the one-sided YES signal.",
      confidence: "HIGH" as const,
      riskLevel: "LOW" as const,
      evidenceRefs: ["context_candidate_poly_fed_cuts_july_1"] as const,
      externalRiskFlags: [] as const,
    }),
    smallStakeAmount: "5.00",
    approvedBy: "demo_user",
    createTopicId: nextId("topic"),
    createScreeningId: nextId("screening"),
    createEvidenceSnapshotId: nextId("snapshot"),
    createDossierId: nextId("dossier"),
    createDecisionRunId: nextId("run"),
    createMarketStructureRecommendationId: nextId("rec_ms"),
    createExternalRiskRecommendationId: nextId("rec_er"),
    createWalletActionProposalId: nextId("wallet"),
    createFinalDecisionId: nextId("decision"),
    createAuditAnchorId: nextId("anchor"),
    createUserApprovalId: nextId("approval"),
    createExecutionRecordId: nextId("execution"),
  });

  return {
    status: 201,
    body: result,
  };
}
