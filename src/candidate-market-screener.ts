import type {
  CandidateMarket,
  CandidateMarketScreeningResult,
  DecisionTopic,
  DecisionTimelineState,
  IsoTimestamp,
  MarketRejection,
  MarketRejectionReason,
  OneSidedSignal,
  ScreeningOutcome,
} from "./domain.js";
import type { DecisionTopicIntake } from "./decision-topic-intake.js";
import type { FetchedPolymarketMarket } from "./polymarket-market-fetch.js";

export type ScreenCandidateMarketsInput = {
  topicId: string;
  timeline: readonly DecisionTimelineState[];
  markets: readonly FetchedPolymarketMarket[];
  now: IsoTimestamp;
  minimumLiquidity: number;
  minimumHoursUntilClose: number;
  oneSidedPriceThreshold: number;
};

export type ScreenCandidateMarketsForTopicInput = Omit<
  ScreenCandidateMarketsInput,
  "topicId" | "timeline"
> & {
  intake: DecisionTopicIntake;
};

export type CandidateMarketsAvailableResult = {
  kind: "candidate_markets_screened";
  topic: DecisionTopic;
  candidateMarketScreeningResult: CandidateMarketScreeningResult;
  decisionRun: undefined;
  timeline: readonly DecisionTimelineState[];
};

export type NoCandidateMarketsResult = {
  kind: "screening_outcome";
  topic: DecisionTopic;
  candidateMarketScreeningResult: CandidateMarketScreeningResult;
  screeningOutcome: ScreeningOutcome;
  decisionRun: undefined;
  timeline: readonly DecisionTimelineState[];
};

export type ScreenCandidateMarketsForTopicResult =
  | CandidateMarketsAvailableResult
  | NoCandidateMarketsResult;

export function screenCandidateMarketsForTopic(
  input: ScreenCandidateMarketsForTopicInput,
): ScreenCandidateMarketsForTopicResult {
  const candidateMarketScreeningResult = screenCandidateMarkets({
    topicId: input.intake.topic.id,
    timeline: [...input.intake.timeline, "markets_fetched"],
    markets: input.markets,
    now: input.now,
    minimumLiquidity: input.minimumLiquidity,
    minimumHoursUntilClose: input.minimumHoursUntilClose,
    oneSidedPriceThreshold: input.oneSidedPriceThreshold,
  });

  if (candidateMarketScreeningResult.candidateMarkets.length === 0) {
    return {
      kind: "screening_outcome",
      topic: input.intake.topic,
      candidateMarketScreeningResult,
      screeningOutcome: {
        kind: "screening_outcome",
        topicId: input.intake.topic.id,
        status: "NO_SCREENED_MARKETS",
        reason: "No Candidate Markets passed the Polymarket-only hard gates.",
        rejectedMarketCount: candidateMarketScreeningResult.rejectedMarkets.length,
        createdAt: input.now,
      },
      decisionRun: undefined,
      timeline: candidateMarketScreeningResult.timeline,
    };
  }

  return {
    kind: "candidate_markets_screened",
    topic: input.intake.topic,
    candidateMarketScreeningResult,
    decisionRun: undefined,
    timeline: candidateMarketScreeningResult.timeline,
  };
}

export function screenCandidateMarkets(
  input: ScreenCandidateMarketsInput,
): CandidateMarketScreeningResult {
  const candidateMarkets: CandidateMarket[] = [];
  const rejectedMarkets: MarketRejection[] = [];

  for (const market of input.markets) {
    const rejectionReason = rejectionReasonFor(market, input);
    if (rejectionReason !== undefined) {
      rejectedMarkets.push({
        sourceMarketId: market.id,
        reason: rejectionReason,
        message: rejectionMessage(rejectionReason),
        rejectedAt: input.now,
      });
      continue;
    }

    candidateMarkets.push(
      toCandidateMarket(market, input.oneSidedPriceThreshold),
    );
  }

  return {
    kind: "candidate_markets_screened",
    topicId: input.topicId,
    screenedAt: input.now,
    candidateMarkets,
    rejectedMarkets,
    timeline: [...input.timeline, "candidate_markets_screened"],
  };
}

function toCandidateMarket(
  market: FetchedPolymarketMarket,
  oneSidedPriceThreshold: number,
): CandidateMarket {
  const yesPrice = market.prices.YES ?? Number.NaN;
  const noPrice = market.prices.NO ?? Number.NaN;
  const oneSidedSignal = createOneSidedSignal(
    yesPrice,
    noPrice,
    oneSidedPriceThreshold,
  );

  if (oneSidedSignal === undefined) {
    throw new Error("Candidate Market requires a One-Sided Signal.");
  }

  return {
    id: `candidate_${market.id}`,
    sourceMarketId: market.id,
    question: market.question,
    outcomes: ["YES", "NO"],
    prices: {
      yes: yesPrice,
      no: noPrice,
    },
    volume: market.volume ?? 0,
    liquidity: market.liquidity ?? 0,
    closeTime: market.closeTime ?? "",
    resolutionRules: market.resolutionRules ?? "",
    oneSidedSignal,
    screeningRationale: "Polymarket-only hard gates passed.",
  };
}

function createOneSidedSignal(
  yesPrice: number,
  noPrice: number,
  oneSidedPriceThreshold: number,
): OneSidedSignal | undefined {
  if (yesPrice >= oneSidedPriceThreshold) {
    return {
      side: "YES",
      price: yesPrice,
      rationale: `YES price ${yesPrice.toFixed(2)} meets one-sided threshold ${oneSidedPriceThreshold.toFixed(2)}.`,
    };
  }

  if (noPrice < oneSidedPriceThreshold) {
    return undefined;
  }

  return {
    side: "NO",
    price: noPrice,
    rationale: `NO price ${noPrice.toFixed(2)} meets one-sided threshold ${oneSidedPriceThreshold.toFixed(2)}.`,
  };
}

function rejectionReasonFor(
  market: FetchedPolymarketMarket,
  input: ScreenCandidateMarketsInput,
): MarketRejectionReason | undefined {
  if (market.status !== "active") {
    return "CLOSED_OR_PAUSED";
  }

  if (market.outcomes.length > 2) {
    return "COMPLEX_MULTI_RESULT_MARKET";
  }

  if (!hasYesNoOutcomes(market)) {
    return "NON_YES_NO_OUTCOMES";
  }

  if (market.resolutionRules === undefined || market.resolutionRules.trim() === "") {
    return "UNCLEAR_RESOLUTION_RULES";
  }

  if ((market.liquidity ?? 0) < input.minimumLiquidity) {
    return "LOW_LIQUIDITY";
  }

  if (hoursUntil(market.closeTime, input.now) < input.minimumHoursUntilClose) {
    return "TOO_NEAR_RESOLUTION";
  }

  if (
    createOneSidedSignal(
      market.prices.YES ?? Number.NaN,
      market.prices.NO ?? Number.NaN,
      input.oneSidedPriceThreshold,
    ) === undefined
  ) {
    return "NO_ONE_SIDED_SIGNAL";
  }

  if (market.raw.specializedKnowledgeRequired === true) {
    return "SPECIALIZED_KNOWLEDGE_REQUIRED";
  }

  return undefined;
}

function hasYesNoOutcomes(market: FetchedPolymarketMarket): boolean {
  return market.outcomes.length === 2
    && market.outcomes.includes("YES")
    && market.outcomes.includes("NO");
}

function hoursUntil(closeTime: IsoTimestamp | undefined, now: IsoTimestamp): number {
  if (closeTime === undefined) {
    return 0;
  }

  return (Date.parse(closeTime) - Date.parse(now)) / 3_600_000;
}

function rejectionMessage(reason: MarketRejectionReason): string {
  const messages: Record<MarketRejectionReason, string> = {
    CLOSED_OR_PAUSED: "Market is closed or paused.",
    NON_YES_NO_OUTCOMES: "Market does not have clear YES/NO outcomes.",
    UNCLEAR_RESOLUTION_RULES: "Market does not have usable resolution rules.",
    LOW_LIQUIDITY: "Market liquidity is below the MVP threshold.",
    TOO_NEAR_RESOLUTION: "Market is too close to resolution.",
    COMPLEX_MULTI_RESULT_MARKET: "Complex multi-result markets are out of MVP scope.",
    NO_ONE_SIDED_SIGNAL: "Market prices do not show a one-sided signal.",
    SPECIALIZED_KNOWLEDGE_REQUIRED: "Market requires specialized quantitative or insider knowledge.",
  };

  return messages[reason];
}
