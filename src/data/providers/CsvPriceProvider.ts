import axios from 'axios';
import { parsePriceTable } from '../csv/parsePriceRecords.ts';
import type { PriceRecord, PriceTable } from '../../types/stock.ts';
import { SymbolNotFoundError, type PriceProvider } from './StockProvider.ts';

/** Path (relative to the Vite base URL) of the flat-file price database. */
export const LOCAL_DATA_CSV_PATH = 'local-data.csv';

export type TextLoader = () => Promise<string>;

/** Fetches the CSV served from `public/` via HTTP. */
export function createHttpTextLoader(url: string): TextLoader {
  return async () => {
    const response = await axios.get<string>(url, {
      responseType: 'text',
      // axios would otherwise try to JSON-parse the body
      transformResponse: [(data: string) => data],
    });
    return response.data;
  };
}

export interface CsvPriceProvider extends PriceProvider {
  /** All symbols present in the file, sorted alphabetically. */
  listSymbols(): Promise<string[]>;
}

/**
 * A {@link PriceProvider} backed by a CSV file. The file is loaded and parsed
 * once (lazily, on first use) and then cached for the provider's lifetime.
 */
export function createCsvPriceProvider(loadText: TextLoader): CsvPriceProvider {
  let tablePromise: Promise<PriceTable> | null = null;

  const getTable = (): Promise<PriceTable> => {
    if (!tablePromise) {
      tablePromise = loadText()
        .then(parsePriceTable)
        .catch((err: unknown) => {
          // Don't cache failures; allow a retry on the next call.
          tablePromise = null;
          throw err;
        });
    }
    return tablePromise;
  };

  return {
    async listSymbols() {
      return Object.keys(await getTable()).sort();
    },

    async getPrices(symbol: string): Promise<PriceRecord[]> {
      const table = await getTable();
      const series = table[symbol];
      if (!series || series.length === 0) {
        throw new SymbolNotFoundError(symbol, {
          source: 'the local data file',
          availableSymbols: Object.keys(table).sort(),
        });
      }
      return series;
    },
  };
}

/** Default provider wired to `public/local-data.csv`. */
export function createDefaultCsvPriceProvider(baseUrl: string = import.meta.env.BASE_URL): CsvPriceProvider {
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return createCsvPriceProvider(createHttpTextLoader(`${base}${LOCAL_DATA_CSV_PATH}`));
}
