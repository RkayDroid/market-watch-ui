import axios, { isAxiosError, type AxiosRequestConfig } from 'axios';
import type { LiveApiConfig } from '../../config/liveApiConfig.ts';
import type { PerformancePeriod } from '../../types/performance.ts';
import type { HighLow, PriceSeries, StockDetails } from '../../types/stock.ts';
import { parseHighLow } from '../highLow.ts';
import { InvalidPayloadError } from '../payload.ts';
import { parsePriceSeries } from '../priceSeries.ts';
import { parseStockDetails } from '../stockDetails.ts';
import { LiveApiError, SymbolNotFoundError, type StockProvider } from './StockProvider.ts';

/* ---------------------------------------------------------------------------
 * API contract (payload shapes are documented next to each parser in src/data/)
 *
 *   GET {baseUrl}/stock/{SYMBOL}                          → stock details
 *   GET {baseUrl}/stock/{SYMBOL}/historic?period={PERIOD} → sampled prices over the period
 *   GET {baseUrl}/stock/{SYMBOL}/highlow?period={PERIOD}  → high/low over the period
 *   Authorization: Bearer {apiKey}                        (only when configured)
 *
 *   PERIOD ∈ DAY | WEEK | MONTH | HALF_YEAR | YEAR | FIVE_YEAR
 *   404 → symbol unknown
 * ------------------------------------------------------------------------- */

export const LIVE_API_SOURCE_LABEL = 'the live API';

/** Minimal surface of an HTTP client the provider needs; axios satisfies it. */
export interface HttpClient {
  get(url: string, config?: AxiosRequestConfig): Promise<{ data: unknown }>;
}

function stockBase(baseUrl: string, symbol: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/stock/${encodeURIComponent(symbol)}`;
}

/** `{base}/stock/{SYMBOL}`. Pure; exported for testing. */
export function buildStockUrl(baseUrl: string, symbol: string): string {
  return stockBase(baseUrl, symbol);
}

/** `{base}/stock/{SYMBOL}/historic?period={PERIOD}`. */
export function buildHistoricUrl(baseUrl: string, symbol: string, period: PerformancePeriod): string {
  return `${stockBase(baseUrl, symbol)}/historic?${new URLSearchParams({ period })}`;
}

/** `{base}/stock/{SYMBOL}/highlow?period={PERIOD}`. */
export function buildHighLowUrl(baseUrl: string, symbol: string, period: PerformancePeriod): string {
  return `${stockBase(baseUrl, symbol)}/highlow?${new URLSearchParams({ period })}`;
}

/**
 * Runs a payload parser, converting contract violations into
 * {@link LiveApiError} (`kind: 'malformed'`).
 */
export function parseLiveApiResponse<T>(parse: (payload: unknown) => T, payload: unknown, symbol: string): T {
  try {
    return parse(payload);
  } catch (err) {
    if (err instanceof InvalidPayloadError) {
      throw new LiveApiError(
        'malformed',
        `The live API returned an unexpected ${err.subject} response for ${symbol}: ${err.reason}.`,
      );
    }
    throw err;
  }
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
}

/**
 * {@link StockProvider} backed by the live stock API described in the contract above.
 * Configure the base URL (and key) via `.env`; see `.env.example`.
 */
export function createLiveApiStockProvider(
  config: LiveApiConfig,
  options: LiveApiProviderOptions = {},
): StockProvider {
  const { client = axios } = options;

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (config.apiKey) headers.Authorization = `Bearer ${config.apiKey}`;

  async function request<T>(url: string, symbol: string, parse: (payload: unknown) => T): Promise<T> {
    try {
      const response = await client.get(url, { headers, timeout: config.timeoutMs });
      return parseLiveApiResponse(parse, response.data, symbol);
    } catch (err) {
      throw toLiveApiError(err, symbol, url);
    }
  }

  return {
    getDetails(symbol): Promise<StockDetails> {
      return request(buildStockUrl(config.baseUrl, symbol), symbol, parseStockDetails);
    },
    getPriceSeries(symbol, period): Promise<PriceSeries> {
      return request(buildHistoricUrl(config.baseUrl, symbol, period), symbol, (payload) =>
        parsePriceSeries(payload, { symbol, period }),
      );
    },
    getHighLow(symbol, period): Promise<HighLow> {
      return request(buildHighLowUrl(config.baseUrl, symbol, period), symbol, (payload) =>
        parseHighLow(payload, { symbol, period }),
      );
    },
  };
}
