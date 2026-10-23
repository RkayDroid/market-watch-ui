import type { PriceProvider } from '../data/providers/PriceProvider.ts';
import { normalizeSymbol } from '../data/csv/parsePriceRecords.ts';
import type { DataSource, StockData } from '../types/stock.ts';
import { summarizeStock, type HourLabelFormatter } from './stockAnalytics.ts';

export type ProviderRegistry = Record<DataSource, PriceProvider>;

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
      const records = await providers[source].getPrices(symbol);
      return summarizeStock(symbol, records, options.formatLabel);
    },
  };
}
