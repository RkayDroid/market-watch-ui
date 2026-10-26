import axios, { isAxiosError } from 'axios';
import type { PerformancePeriod } from '../../types/performance.ts';
import type { HighLow, PriceSeries, StockDetails } from '../../types/stock.ts';
import { parseHighLow } from '../highLow.ts';
import { InvalidPayloadError } from '../payload.ts';
import { parsePriceSeries } from '../priceSeries.ts';
import { parseStockDetails } from '../stockDetails.ts';
import { SymbolNotFoundError, type StockProvider } from './StockProvider.ts';

export const LOCAL_SOURCE_LABEL = 'the offline data';

/** Directory (relative to the Vite base URL) holding the offline JSON fixtures. */
export const LOCAL_DATA_DIR = 'data';

/**
 * Symbols with fixtures under `public/data/`. Static hosting cannot list a directory,
 * so this is maintained by hand and checked against the folder by `localFixtures.test.ts`.
 */
export const OFFLINE_SYMBOLS: readonly string[] = ['AAPL', 'GOOG', 'META'];

/* Fixture paths, relative to the Vite base URL. Names mirror the live endpoints. */

/** `data/detail-{SYMBOL}.json` — the `/stock/{symbol}` payload. */
export function localDetailsPath(symbol: string): string {
  return `${LOCAL_DATA_DIR}/detail-${encodeURIComponent(symbol)}.json`;
}

/** `data/historic-{SYMBOL}-{PERIOD}.json` — the `/stock/{symbol}/historic?period=` payload. */
export function localHistoricPath(symbol: string, period: PerformancePeriod): string {
  return `${LOCAL_DATA_DIR}/historic-${encodeURIComponent(symbol)}-${period}.json`;
}

/** `data/highlow-{SYMBOL}-{PERIOD}.json` — the `/stock/{symbol}/highlow?period=` payload. */
export function localHighLowPath(symbol: string, period: PerformancePeriod): string {
  return `${LOCAL_DATA_DIR}/highlow-${encodeURIComponent(symbol)}-${period}.json`;
}

/** Loads the raw JSON at a fixture path, or `null` when the offline source has no such file. */
export type JsonLoader = (path: string) => Promise<unknown | null>;

/**
 * Fetches fixtures from `public/` via HTTP. "No file" is signalled either by a 404 or —
 * on hosts with an SPA rewrite that answer every path with `index.html` — by a non-JSON
 * response, so both resolve to `null`.
 */
export function createHttpJsonLoader(baseUrl: string): JsonLoader {
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return async (path) => {
    try {
      const response = await axios.get<unknown>(`${base}${path}`, { headers: { Accept: 'application/json' } });
      const contentType = String(response.headers?.['content-type'] ?? '');
      return contentType.includes('json') ? response.data : null;
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 404) return null;
      throw err;
    }
  };
}

export interface LocalStockProviderOptions {
  /** Symbols offered as suggestions when a lookup misses; defaults to {@link OFFLINE_SYMBOLS}. */
  availableSymbols?: readonly string[];
}

/**
 * Offline {@link StockProvider} over `public/data/*.json` — copies of responses captured
 * from the live API, parsed with the same parsers the live provider uses.
 */
export function createLocalStockProvider(
  loadJson: JsonLoader,
  { availableSymbols = OFFLINE_SYMBOLS }: LocalStockProviderOptions = {},
): StockProvider {
  async function load<T>(path: string, symbol: string, parse: (payload: unknown) => T): Promise<T> {
    const payload = await loadJson(path);
    if (payload === null) {
      throw new SymbolNotFoundError(symbol, { source: LOCAL_SOURCE_LABEL, availableSymbols });
    }
    try {
      return parse(payload);
    } catch (err) {
      if (err instanceof InvalidPayloadError) {
        throw new Error(`The offline file ${path} is malformed: ${err.reason}.`, { cause: err });
      }
      throw err;
    }
  }

  return {
    getDetails(symbol): Promise<StockDetails> {
      return load(localDetailsPath(symbol), symbol, parseStockDetails);
    },
    getPriceSeries(symbol, period): Promise<PriceSeries> {
      return load(localHistoricPath(symbol, period), symbol, (payload) =>
        parsePriceSeries(payload, { symbol, period }),
      );
    },
    getHighLow(symbol, period): Promise<HighLow> {
      return load(localHighLowPath(symbol, period), symbol, (payload) => parseHighLow(payload, { symbol, period }));
    },
  };
}

/** Default offline provider wired to `public/data/`. */
export function createDefaultLocalStockProvider(baseUrl: string = import.meta.env.BASE_URL): StockProvider {
  return createLocalStockProvider(createHttpJsonLoader(baseUrl));
}
