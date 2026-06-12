import { execFile } from "node:child_process";
import { promisify } from "node:util";

export type LivePolymarketFetchResponse = {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
};

export type LivePolymarketFetcher = (
  url: string,
) => Promise<LivePolymarketFetchResponse>;

export type LivePolymarketMarketEvidence = {
  id: string;
  conditionId?: string;
  slug?: string;
  question: string;
  outcomes: readonly string[];
  prices: Readonly<Record<string, number>>;
  status: "active" | "closed" | "paused" | "unknown";
  volume?: number;
  liquidity?: number;
  closeTime?: string;
  resolutionRules?: string;
  source: "polymarket";
  sourceApiUrl?: string;
  sourceUrl?: string;
  raw: Record<string, unknown>;
};

export type FetchLivePolymarketMarketEvidenceInput = {
  market: string;
  endpoint?: string;
  fetcher?: LivePolymarketFetcher;
};

export type LivePolymarketMarketEvidenceResult =
  | {
      kind: "market_found";
      evidence: LivePolymarketMarketEvidence;
    }
  | {
      kind: "market_not_found";
      message: string;
    }
  | {
      kind: "market_fetch_failed";
      status?: number;
      message: string;
    };

const DEFAULT_GAMMA_MARKETS_ENDPOINT =
  "https://gamma-api.polymarket.com/markets";
const execFileAsync = promisify(execFile);

export async function fetchLivePolymarketMarketEvidence(
  input: FetchLivePolymarketMarketEvidenceInput,
): Promise<LivePolymarketMarketEvidenceResult> {
  const market = input.market.trim();
  if (market === "") {
    return {
      kind: "market_not_found",
      message: "A Polymarket market slug or id is required.",
    };
  }

  const endpoint = input.endpoint ?? DEFAULT_GAMMA_MARKETS_ENDPOINT;
  const fetcher = input.fetcher ?? defaultLivePolymarketFetcher;
  const url = buildGammaMarketsUrl(endpoint, market);

  try {
    const response = await fetcher(url);
    if (!response.ok) {
      return {
        kind: "market_fetch_failed",
        status: response.status,
        message: `Polymarket market request failed with ${response.status}.`,
      };
    }

    const payload = await response.json();
    const rawMarket = findMatchingMarket(extractMarketPayloads(payload), market);

    if (rawMarket === undefined) {
      return {
        kind: "market_not_found",
        message: `No Polymarket market found for "${market}".`,
      };
    }

    return {
      kind: "market_found",
      evidence: {
        ...normalizePolymarketMarketEvidence(rawMarket),
        sourceApiUrl: url,
      },
    };
  } catch (error) {
    return {
      kind: "market_fetch_failed",
      message: error instanceof Error ? error.message : "Polymarket market request failed.",
    };
  }
}

async function defaultLivePolymarketFetcher(
  url: string,
): Promise<LivePolymarketFetchResponse> {
  try {
    return await globalThis.fetch(url);
  } catch (error) {
    if (process.platform !== "win32") {
      throw error;
    }

    const { stdout } = await execFileAsync(
      "powershell.exe",
      [
        "-NoProfile",
        "-Command",
        "Invoke-WebRequest -Uri $env:COLDREAD_POLYMARKET_URL -UseBasicParsing | Select-Object -ExpandProperty Content",
      ],
      {
        env: {
          ...process.env,
          COLDREAD_POLYMARKET_URL: url,
        },
        maxBuffer: 5 * 1024 * 1024,
      },
    );

    return {
      ok: true,
      status: 200,
      json: async () => JSON.parse(stdout) as unknown,
    };
  }
}

export function normalizePolymarketMarketEvidence(
  raw: Record<string, unknown>,
): LivePolymarketMarketEvidence {
  const outcomes = parseStringList(raw.outcomes).map((outcome) => outcome.toUpperCase());
  const outcomePrices = parseNumberList(raw.outcomePrices);
  const slug = optionalString(raw.slug);

  return {
    id: toStringValue(raw.id ?? raw.marketId ?? raw.conditionId),
    conditionId: optionalString(raw.conditionId),
    slug,
    question: toStringValue(raw.question ?? raw.title ?? raw.slug),
    outcomes,
    prices: buildPrices(outcomes, outcomePrices),
    status: marketStatus(raw),
    volume: optionalNumber(raw.volume ?? raw.volumeNum),
    liquidity: optionalNumber(raw.liquidity ?? raw.liquidityNum),
    closeTime: optionalString(raw.endDate ?? raw.endDateIso ?? raw.closeTime),
    resolutionRules: optionalString(raw.resolutionRules ?? raw.rules ?? raw.description),
    source: "polymarket",
    sourceUrl: slug === undefined ? undefined : `https://polymarket.com/event/${slug}`,
    raw,
  };
}

function buildGammaMarketsUrl(endpoint: string, market: string): string {
  const url = new URL(endpoint);
  url.searchParams.set("search", market);
  url.searchParams.set("limit", "10");
  url.searchParams.set("active", "true");
  url.searchParams.set("closed", "false");
  return url.toString();
}

function findMatchingMarket(
  markets: readonly Record<string, unknown>[],
  market: string,
): Record<string, unknown> | undefined {
  const normalizedNeedle = market.toLowerCase();

  return markets.find((candidate) => {
    const identifiers = [
      candidate.id,
      candidate.marketId,
      candidate.conditionId,
      candidate.slug,
    ].flatMap((value) => optionalString(value) ?? []);

    return identifiers.some((identifier) => identifier.toLowerCase() === normalizedNeedle);
  });
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

function buildPrices(
  outcomes: readonly string[],
  prices: readonly number[],
): Readonly<Record<string, number>> {
  return Object.fromEntries(
    outcomes.map((outcome, index) => [outcome, prices[index] ?? Number.NaN]),
  );
}

function marketStatus(raw: Record<string, unknown>): LivePolymarketMarketEvidence["status"] {
  if (raw.closed === true) return "closed";
  if (raw.active === true) return "active";
  if (raw.active === false) return "paused";
  return "unknown";
}

function parseStringList(value: unknown): string[] {
  const parsed = parseMaybeJson(value);
  if (!Array.isArray(parsed)) return [];
  return parsed.map(String);
}

function parseNumberList(value: unknown): number[] {
  const parsed = parseMaybeJson(value);
  if (!Array.isArray(parsed)) return [];
  return parsed.map(Number).filter((value) => !Number.isNaN(value));
}

function parseMaybeJson(value: unknown): unknown {
  if (typeof value !== "string") return value;

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function optionalNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const number = Number(value);
  return Number.isNaN(number) ? undefined : number;
}

function optionalString(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  return String(value);
}

function toStringValue(value: unknown): string {
  return optionalString(value) ?? "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
