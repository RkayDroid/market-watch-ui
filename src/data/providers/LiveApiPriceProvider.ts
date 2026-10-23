import axios, { isAxiosError, type AxiosRequestConfig } from 'axios';
import type { LiveApiConfig } from '../../config/liveApiConfig.ts';
import type { PriceRecord } from '../../types/stock.ts';
import { LiveApiError, SymbolNotFoundError, type PriceProvider } from './PriceProvider.ts';

/* ---------------------------------------------------------------------------
 * API contract (assumed — adjust `parseLiveApiResponse` when the real API lands)
 *
 *   GET {baseUrl}/prices/{SYMBOL}?interval=1h&limit=24
 *   Authorization: Bearer {apiKey}          (only when configured)
 *
 *   200 → { "symbol": "AAPL",
 *           "prices": [ { "timestamp": "2026-10-21T15:00:00Z", "price": 220.10 }, … ] }
 *   404 → symbol unknown
 * ------------------------------------------------------------------------- */

export const LIVE_API_SOURCE_LABEL = 'the live API';
export const DEFAULT_INTERVAL = '1h';
export const DEFAULT_LIMIT = 24;

export interface LiveApiPricePoint {
  timestamp: string;
  price: number;
}

export interface LiveApiPriceResponse {
  symbol: string;
  prices: LiveApiPricePoint[];
}

export interface PricesQuery {
  interval?: string;
  limit?: number;
}

/** Minimal surface of an HTTP client the provider needs; axios satisfies it. */
export interface HttpClient {
  get(url: string, config?: AxiosRequestConfig): Promise<{ data: unknown }>;
}

/** Builds the request URL for a symbol. Pure; exported for testing. */
export function buildPricesUrl(baseUrl: string, symbol: string, query: PricesQuery = {}): string {
  const { interval = DEFAULT_INTERVAL, limit = DEFAULT_LIMIT } = query;
  const base = baseUrl.replace(/\/+$/, '');
  const params = new URLSearchParams({ interval, limit: String(limit) });
  return `${base}/prices/${encodeURIComponent(symbol)}?${params.toString()}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Validates the raw API payload and maps it to chronologically sorted {@link PriceRecord}s.
 * Throws {@link LiveApiError} (`kind: 'malformed'`) for anything off-contract.
 * This is the single place to touch if the real API's shape differs.
 */
export function parseLiveApiResponse(payload: unknown, symbol: string): PriceRecord[] {
  const malformed = (why: string) =>
    new LiveApiError('malformed', `The live API returned an unexpected response for ${symbol}: ${why}.`);

  if (!isRecord(payload)) throw malformed('body is not an object');
  if (!Array.isArray(payload.prices)) throw malformed('"prices" is not an array');
  if (payload.prices.length === 0) throw malformed('"prices" is empty');

  const records = payload.prices.map((point, i): PriceRecord => {
    if (!isRecord(point)) throw malformed(`prices[${i}] is not an object`);

    const ts = Date.parse(String(point.timestamp ?? ''));
    if (Number.isNaN(ts)) throw malformed(`prices[${i}].timestamp is not a valid date`);

    const price = typeof point.price === 'number' ? point.price : Number(point.price);
    if (!Number.isFinite(price)) throw malformed(`prices[${i}].price is not a number`);

    return { date: new Date(ts).toISOString(), rate: price };
  });

  return records.sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
}

/** Converts any thrown value from the HTTP layer into a typed, user-presentable error. */
export function toLiveApiError(err: unknown, symbol: string, url: string): Error {
  if (err instanceof LiveApiError || err instanceof SymbolNotFoundError) return err;

  if (isAxiosError(err)) {
    const status = err.response?.status;

    if (status === 404) {
      return new SymbolNotFoundError(symbol, { source: LIVE_API_SOURCE_LABEL });
    }
    if (status !== undefined) {
      return new LiveApiError('http', `The live API responded with HTTP ${status} for ${symbol}.`, {
        status,
        url,
      });
    }
    if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
      return new LiveApiError('timeout', `The live API timed out for ${symbol}.`, { url });
    }
    return new LiveApiError('unreachable', `Could not reach the live API at ${url}.`, { url });
  }

  return new LiveApiError('unreachable', `The live API request for ${symbol} failed.`, { url });
}

export interface LiveApiProviderOptions {
  /** Injected for tests; defaults to the global axios instance. */
  client?: HttpClient;
  query?: PricesQuery;
}

/**
 * {@link PriceProvider} backed by the live price API described in the contract above.
 * The endpoint is not reachable in this repo's sandbox; configure it via `.env`.
 */
export function createLiveApiPriceProvider(
  config: LiveApiConfig,
  options: LiveApiProviderOptions = {},
): PriceProvider {
  const { client = axios, query } = options;

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (config.apiKey) headers.Authorization = `Bearer ${config.apiKey}`;

  return {
    async getPrices(symbol: string): Promise<PriceRecord[]> {
      const url = buildPricesUrl(config.baseUrl, symbol, query);
      try {
        const response = await client.get(url, { headers, timeout: config.timeoutMs });
        return parseLiveApiResponse(response.data, symbol);
      } catch (err) {
        throw toLiveApiError(err, symbol, url);
      }
    },
  };
}
