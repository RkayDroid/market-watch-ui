import axios, { isAxiosError, type AxiosRequestConfig } from 'axios';
import type { LiveApiConfig } from '../../config/liveApiConfig.ts';
import type { StockDetails } from '../../types/stock.ts';
import { InvalidStockDetailsError, parseStockDetails } from '../stockDetails.ts';
import { LiveApiError, SymbolNotFoundError, type StockProvider } from './StockProvider.ts';

/* ---------------------------------------------------------------------------
 * API contract
 *
 *   GET {baseUrl}/stock/{SYMBOL}
 *   Authorization: Bearer {apiKey}          (only when configured)
 *
 *   200 → { "ticker": "AAPL", "symbol": "AAPL", "displayName": "Apple",
 *           "longName": "Apple Inc.", "sector": "Technology", "exchange": "NMS",
 *           "market": "us_market", "currency": "USD", "language": "en-US",
 *           "fulldayPrice": 347.725 }
 *   404 → symbol unknown
 *
 * The endpoint carries no historic prices, so this provider has no `getPrices`;
 * the UI hides the chart and hourly table for this source.
 * ------------------------------------------------------------------------- */

export const LIVE_API_SOURCE_LABEL = 'the live API';

/** Minimal surface of an HTTP client the provider needs; axios satisfies it. */
export interface HttpClient {
  get(url: string, config?: AxiosRequestConfig): Promise<{ data: unknown }>;
}

/** Builds the request URL for a symbol. Pure; exported for testing. */
export function buildStockUrl(baseUrl: string, symbol: string): string {
  const base = baseUrl.replace(/\/+$/, '');
  return `${base}/stock/${encodeURIComponent(symbol)}`;
}

/**
 * Validates the raw API payload and maps it to {@link StockDetails}.
 * Throws {@link LiveApiError} (`kind: 'malformed'`) for anything off-contract.
 */
export function parseLiveApiResponse(payload: unknown, symbol: string): StockDetails {
  try {
    return parseStockDetails(payload);
  } catch (err) {
    if (err instanceof InvalidStockDetailsError) {
      throw new LiveApiError(
        'malformed',
        `The live API returned an unexpected response for ${symbol}: ${err.reason}.`,
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

  return {
    async getDetails(symbol: string): Promise<StockDetails> {
      const url = buildStockUrl(config.baseUrl, symbol);
      try {
        const response = await client.get(url, { headers, timeout: config.timeoutMs });
        return parseLiveApiResponse(response.data, symbol);
      } catch (err) {
        throw toLiveApiError(err, symbol, url);
      }
    },
  };
}
