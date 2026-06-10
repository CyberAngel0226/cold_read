import type {
  DecisionTimelineState,
  IsoTimestamp,
} from "./domain.js";
import type { DecisionTopicIntake } from "./decision-topic-intake.js";

export type PolymarketFetchResponse = {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
};

export type PolymarketFetcher = (
  url: string,
) => Promise<PolymarketFetchResponse>;

export type FetchedPolymarketMarket = {
  id: string;
  conditionId?: string;
  question: string;
  outcomes: readonly string[];
  prices: Readonly<Record<string, number>>;
  status: "active" | "closed" | "paused" | "unknown";
  volume?: number;
  liquidity?: number;
  closeTime?: IsoTimestamp;
  resolutionRules?: string;
  raw: Record<string, unknown>;
};

export type FetchPolymarketMarketsInput = {
  intake: DecisionTopicIntake;
  now: IsoTimestamp;
  limit?: number;
  endpoint?: string;
  fetcher?: PolymarketFetcher;
};

export type PolymarketMarketsFetched = {
  kind: "markets_fetched";
  topicId: string;
  fetchedAt: IsoTimestamp;
  markets: readonly FetchedPolymarketMarket[];
  timeline: readonly DecisionTimelineState[];
};

export type PolymarketMarketFetchFailed = {
  kind: "market_fetch_failed";
  topicId: string;
  failedAt: IsoTimestamp;
  status?: number;
  message: string;
  timeline: readonly DecisionTimelineState[];
};

export type PolymarketMarketFetchResult =
  | PolymarketMarketsFetched
  | PolymarketMarketFetchFailed;

const DEFAULT_GAMMA_MARKETS_ENDPOINT =
  "https://gamma-api.polymarket.com/markets";

export async function fetchPolymarketMarketsForTopic(
  input: FetchPolymarketMarketsInput,
): Promise<PolymarketMarketFetchResult> {
  const endpoint = input.endpoint ?? DEFAULT_GAMMA_MARKETS_ENDPOINT;
  const limit = input.limit ?? 20;
  const fetcher = input.fetcher ?? globalThis.fetch;
  const url = buildMarketsUrl(endpoint, input.intake.topic.text, limit);

  try {
    const response = await fetcher(url);

    if (!response.ok) {
      return marketFetchFailed(input, `Polymarket request failed with ${response.status}.`, response.status);
    }

    const payload = await response.json();
    const markets = extractMarketPayloads(payload).map(toFetchedPolymarketMarket);

    return {
      kind: "markets_fetched",
      topicId: input.intake.topic.id,
      fetchedAt: input.now,
      markets,
      timeline: [...input.intake.timeline, "markets_fetched"],
    };
  } catch (error) {
    return marketFetchFailed(input, error instanceof Error ? error.message : "Polymarket request failed.");
  }
}

function buildMarketsUrl(endpoint: string, topicText: string, limit: number): string {
  const url = new URL(endpoint);
  url.searchParams.set("search", topicText);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("active", "true");
  url.searchParams.set("closed", "false");
  return url.toString();
}

function marketFetchFailed(
  input: FetchPolymarketMarketsInput,
  message: string,
  status?: number,
): PolymarketMarketFetchFailed {
  const failure: PolymarketMarketFetchFailed = {
    kind: "market_fetch_failed",
    topicId: input.intake.topic.id,
    failedAt: input.now,
    message,
    timeline: input.intake.timeline,
  };

  if (status !== undefined) {
    failure.status = status;
  }

  return failure;
}

function extractMarketPayloads(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) {
    return payload.filter(isRecord);
  }

  if (isRecord(payload)) {
    const candidates = [payload.markets, payload.data, payload.results];
    for (const candidate of candidates) {
      if (Array.isArray(candidate)) {
        return candidate.filter(isRecord);
      }
    }
  }

  return [];
}

function toFetchedPolymarketMarket(raw: Record<string, unknown>): FetchedPolymarketMarket {
  const outcomes = parseStringList(raw.outcomes).map((outcome) => outcome.toUpperCase());
  const outcomePrices = parseNumberList(raw.outcomePrices);

  return {
    id: toStringValue(raw.id ?? raw.marketId ?? raw.conditionId),
    conditionId: optionalString(raw.conditionId),
    question: toStringValue(raw.question ?? raw.title ?? raw.slug),
    outcomes,
    prices: buildPrices(outcomes, outcomePrices),
    status: marketStatus(raw),
    volume: optionalNumber(raw.volume ?? raw.volumeNum),
    liquidity: optionalNumber(raw.liquidity ?? raw.liquidityNum),
    closeTime: optionalString(raw.endDate ?? raw.endDateIso ?? raw.closeTime),
    resolutionRules: optionalString(raw.resolutionRules ?? raw.rules ?? raw.description),
    raw,
  };
}

function buildPrices(
  outcomes: readonly string[],
  prices: readonly number[],
): Readonly<Record<string, number>> {
  return Object.fromEntries(
    outcomes.map((outcome, index) => [outcome, prices[index] ?? Number.NaN]),
  );
}

function marketStatus(raw: Record<string, unknown>): FetchedPolymarketMarket["status"] {
  if (raw.closed === true) {
    return "closed";
  }

  if (raw.active === true) {
    return "active";
  }

  if (raw.active === false) {
    return "paused";
  }

  return "unknown";
}

function parseStringList(value: unknown): string[] {
  const parsed = parseMaybeJson(value);
  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed.map(String);
}

function parseNumberList(value: unknown): number[] {
  const parsed = parseMaybeJson(value);
  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed.map(Number).filter((value) => !Number.isNaN(value));
}

function parseMaybeJson(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function optionalNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const number = Number(value);
  return Number.isNaN(number) ? undefined : number;
}

function optionalString(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  return String(value);
}

function toStringValue(value: unknown): string {
  return optionalString(value) ?? "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
