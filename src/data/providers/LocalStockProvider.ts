import axios, { isAxiosError } from 'axios';
import type { PerformancePeriod } from '../../types/performance.ts';
import type { PriceSeries, StockDetails } from '../../types/stock.ts';
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
export const OFFLINE_SYMBOLS: readonly string[] = ['AAPL', 'BRK.A', 'GOOG', 'META', 'NFLX', 'RBLX', 'TSLA'];

/* Fixture paths, relative to the Vite base URL. Names mirror the live endpoints. */

/** `data/detail-{SYMBOL}.json` — the `/stock/{symbol}` payload. */
export function localDetailsPath(symbol: string): string {
  return `${LOCAL_DATA_DIR}/detail-${encodeURIComponent(symbol)}.json`;
}

/**
 * Reference dates the offline data was captured for, and the fixture suffix holding each.
 * Any other reference date is served from {@link OFFLINE_FALLBACK_REFERENCE_DATE}'s capture.
 */
export const OFFLINE_REFERENCE_DATES: Readonly<Record<string, number>> = {
  '2025-10-10': 1,
  '2026-02-02': 2,
};
export const OFFLINE_FALLBACK_REFERENCE_DATE = '2026-02-02';

/**
 * `data/historic-{SYMBOL}-{PERIOD}.json` — the `/stock/{symbol}/historic?period=` payload.
 * With a reference date: `…-{PERIOD}-1.json` for 2025-10-10, `…-2.json` for 2026-02-02, and the
 * latter again for any other date (the offline set only has those two captures).
 */
export function localHistoricPath(symbol: string, period: PerformancePeriod, referenceDate?: string): string {
  const base = `${LOCAL_DATA_DIR}/historic-${encodeURIComponent(symbol)}-${period}`;
  if (!referenceDate) return `${base}.json`;
  const variant = OFFLINE_REFERENCE_DATES[referenceDate] ?? OFFLINE_REFERENCE_DATES[OFFLINE_FALLBACK_REFERENCE_DATE];
  return `${base}-${variant}.json`;
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
    getPriceSeries(symbol, period, referenceDate): Promise<PriceSeries> {
      // The fixture may be a stand-in for another date, so the served date is not checked
      // against the requested one; the parser reports the date the capture is really for.
      return load(localHistoricPath(symbol, period, referenceDate), symbol, (payload) =>
        parsePriceSeries(payload, { symbol, period }),
      );
    },
  };
}

/** Default offline provider wired to `public/data/`. */
export function createDefaultLocalStockProvider(baseUrl: string = import.meta.env.BASE_URL): StockProvider {
  return createLocalStockProvider(createHttpJsonLoader(baseUrl));
}
