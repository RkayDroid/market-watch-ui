import type { StockProvider } from '../data/providers/StockProvider.ts';
import { normalizeSymbol } from '../utils/symbol.ts';
import type { DataSource, StockData } from '../types/stock.ts';
import { buildStockData, type HourLabelFormatter } from './stockAnalytics.ts';

export type ProviderRegistry = Record<DataSource, StockProvider>;

export interface StockService {
  lookup(symbol: string, source: DataSource): Promise<StockData>;
}

export interface StockServiceOptions {
  formatLabel?: HourLabelFormatter;
}

export class InvalidSymbolError extends Error {
  constructor() {
    super('Please enter a stock symbol.');
    this.name = 'InvalidSymbolError';
  }
}

/**
 * Composes a provider lookup with the analytics layer. Providers are injected so
 * the service (and the UI above it) can be tested with fakes.
 *
 * Details and history are requested together; a provider without `getPrices`
 * (e.g. the live API) yields a `StockData` with `history: null`.
 */
export function createStockService(
  providers: ProviderRegistry,
  options: StockServiceOptions = {},
): StockService {
  return {
    async lookup(rawSymbol, source) {
      const symbol = normalizeSymbol(rawSymbol);
      if (!symbol) {
        throw new InvalidSymbolError();
      }
      const provider = providers[source];
      const [details, records] = await Promise.all([
        provider.getDetails(symbol),
        provider.getPrices ? provider.getPrices(symbol) : Promise.resolve([]),
      ]);
      return buildStockData(details, records, options.formatLabel);
    },
  };
}
