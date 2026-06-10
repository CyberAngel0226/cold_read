import type {
  CandidateMarket,
  CandidateMarketScreeningResult,
  ContextEvidenceItem,
  DecisionRun,
  DecisionTimelineState,
  IsoTimestamp,
  ScreenedMarket,
  ScreeningOutcome,
} from "./domain.js";

export type TavilyContextItem = {
  url: string;
  title: string;
  summary: string;
  majorCounterevidence?: boolean;
};

export type TavilyMarketContextQuery = (
  candidateMarket: CandidateMarket,
) => Promise<readonly TavilyContextItem[]>;

export type ConfirmScreenedMarketsWithTavilyInput = {
  candidateMarketScreeningResult: CandidateMarketScreeningResult;
  now: IsoTimestamp;
  createDecisionRunId: () => string;
  queryTavily: TavilyMarketContextQuery;
};

export type NoConfirmedScreenedMarketsResult = {
  kind: "screening_outcome";
  screeningOutcome: ScreeningOutcome;
  decisionRun: undefined;
  contextEvidenceItems: readonly ContextEvidenceItem[];
};

export type HighConvictionMarketsConfirmedResult = {
  kind: "high_conviction_markets_confirmed";
  screenedMarkets: readonly ScreenedMarket[];
  contextEvidenceItems: readonly ContextEvidenceItem[];
  decisionRun: DecisionRun;
  timeline: readonly DecisionTimelineState[];
};

export type TavilyMarketConfirmationResult =
  | NoConfirmedScreenedMarketsResult
  | HighConvictionMarketsConfirmedResult;

export async function confirmScreenedMarketsWithTavily(
  input: ConfirmScreenedMarketsWithTavilyInput,
): Promise<TavilyMarketConfirmationResult> {
  if (input.candidateMarketScreeningResult.candidateMarkets.length > 0) {
    const screenedMarkets: ScreenedMarket[] = [];
    const contextEvidenceItems: ContextEvidenceItem[] = [];

    for (const candidateMarket of input.candidateMarketScreeningResult.candidateMarkets) {
      const contextItems = await input.queryTavily(candidateMarket);
      contextEvidenceItems.push(
        ...toContextEvidenceItems(candidateMarket, contextItems, input.now),
      );

      if (contextItems.some((contextItem) => contextItem.majorCounterevidence === true)) {
        continue;
      }

      screenedMarkets.push(toScreenedMarket(candidateMarket));
    }

    if (screenedMarkets.length === 0) {
      return {
        kind: "screening_outcome",
        screeningOutcome: {
          kind: "screening_outcome",
          topicId: input.candidateMarketScreeningResult.topicId,
          status: "NO_SCREENED_MARKETS",
          reason: "Tavily context found major counterevidence or reversal risk.",
          rejectedMarketCount: input.candidateMarketScreeningResult.candidateMarkets.length,
          createdAt: input.now,
        },
        decisionRun: undefined,
        contextEvidenceItems,
      };
    }

    return {
      kind: "high_conviction_markets_confirmed",
      screenedMarkets,
      contextEvidenceItems,
      decisionRun: {
        kind: "decision_run",
        id: input.createDecisionRunId(),
        topicId: input.candidateMarketScreeningResult.topicId,
        screenedMarketIds: screenedMarkets.map((market) => market.id),
        status: "CREATED",
        createdAt: input.now,
      },
      timeline: [
        ...input.candidateMarketScreeningResult.timeline,
        "high_conviction_markets_confirmed",
      ],
    };
  }

  return {
    kind: "screening_outcome",
    screeningOutcome: {
      kind: "screening_outcome",
      topicId: input.candidateMarketScreeningResult.topicId,
      status: "NO_SCREENED_MARKETS",
      reason: "No Candidate Markets were available for Tavily confirmation.",
      rejectedMarketCount: 0,
      createdAt: input.now,
    },
    decisionRun: undefined,
    contextEvidenceItems: [],
  };
}

function toContextEvidenceItems(
  candidateMarket: CandidateMarket,
  contextItems: readonly TavilyContextItem[],
  retrievedAt: IsoTimestamp,
): ContextEvidenceItem[] {
  return contextItems.map((contextItem, index) => ({
    id: `context_${candidateMarket.id}_${index + 1}`,
    marketId: candidateMarket.id,
    sourceUrl: contextItem.url,
    title: contextItem.title,
    summary: contextItem.summary,
    retrievedAt,
  }));
}

function toScreenedMarket(candidateMarket: CandidateMarket): ScreenedMarket {
  return {
    id: `screened_${candidateMarket.id}`,
    sourceCandidateMarketId: candidateMarket.id,
    polymarketId: candidateMarket.sourceMarketId,
    question: candidateMarket.question,
    outcomes: candidateMarket.outcomes,
    prices: candidateMarket.prices,
    volume: candidateMarket.volume,
    liquidity: candidateMarket.liquidity,
    closeTime: candidateMarket.closeTime,
    resolutionRules: candidateMarket.resolutionRules,
    oneSidedSignal: candidateMarket.oneSidedSignal,
    confirmationRationale: "Tavily context found no major counterevidence.",
  };
}
