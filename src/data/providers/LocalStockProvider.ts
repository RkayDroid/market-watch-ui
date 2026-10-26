import axios, { isAxiosError } from 'axios';
import type { PriceRecord, StockDetails } from '../../types/stock.ts';
import { InvalidStockDetailsError, parseStockDetails } from '../stockDetails.ts';
import { createDefaultCsvPriceProvider, type CsvPriceProvider } from './CsvPriceProvider.ts';
import { SymbolNotFoundError, type StockProvider } from './StockProvider.ts';

export const LOCAL_SOURCE_LABEL = 'the local data files';

/** Directory (relative to the Vite base URL) holding the offline `detail-{SYMBOL}.json` fixtures. */
export const LOCAL_DETAILS_DIR = 'data';

/** Path of the offline details file for a symbol, relative to the Vite base URL. */
export function localDetailsPath(symbol: string): string {
  return `${LOCAL_DETAILS_DIR}/detail-${encodeURIComponent(symbol)}.json`;
}

/**
 * Loads the raw `/stock/{symbol}`-shaped payload for a symbol, or `null` when
 * the offline source has no details file for it.
 */
export type DetailsLoader = (symbol: string) => Promise<unknown | null>;

/**
 * Fetches `public/data/detail-{SYMBOL}.json` via HTTP. "No file" is signalled either by
 * a 404 or — on hosts with an SPA rewrite that answer every path with `index.html` —
 * by a non-JSON response, so both resolve to `null`.
 */
export function createHttpDetailsLoader(baseUrl: string): DetailsLoader {
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return async (symbol) => {
    try {
      const response = await axios.get<unknown>(`${base}${localDetailsPath(symbol)}`, {
        headers: { Accept: 'application/json' },
      });
      const contentType = String(response.headers?.['content-type'] ?? '');
      return contentType.includes('json') ? response.data : null;
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 404) return null;
      throw err;
    }
  };
}

/**
 * Offline {@link StockProvider}: details come from `detail-{SYMBOL}.json` (captured
 * live responses) and hourly history from the CSV price file. The two need not
 * agree on coverage — a symbol present in only one of them still resolves, with
 * bare details or an empty history respectively.
 */
export function createLocalStockProvider(csv: CsvPriceProvider, loadDetails: DetailsLoader): StockProvider {
  return {
    async getDetails(symbol: string): Promise<StockDetails> {
      const payload = await loadDetails(symbol);
      if (payload !== null) {
        try {
          return parseStockDetails(payload);
        } catch (err) {
          if (err instanceof InvalidStockDetailsError) {
            throw new Error(`The local details file for ${symbol} is malformed: ${err.reason}.`, { cause: err });
          }
          throw err;
        }
      }

      const availableSymbols = await csv.listSymbols();
      if (!availableSymbols.includes(symbol)) {
        throw new SymbolNotFoundError(symbol, { source: LOCAL_SOURCE_LABEL, availableSymbols });
      }
      return { symbol };
    },

    async getPrices(symbol: string): Promise<PriceRecord[]> {
      try {
        return await csv.getPrices(symbol);
      } catch (err) {
        if (err instanceof SymbolNotFoundError) return [];
        throw err;
      }
    },
  };
}

/** Default offline provider wired to `public/local-data.csv` and `public/data/detail-*.json`. */
export function createDefaultLocalStockProvider(baseUrl: string = import.meta.env.BASE_URL): StockProvider {
  return createLocalStockProvider(createDefaultCsvPriceProvider(baseUrl), createHttpDetailsLoader(baseUrl));
}
