import type { StockProvider } from '../data/providers/StockProvider.ts';
import type { PerformancePeriod } from '../types/performance.ts';
import type { DataSource, PastPerformance, StockData } from '../types/stock.ts';
import { normalizeSymbol } from '../utils/symbol.ts';
import { summarizePerformance, type LabelFormatter } from './stockAnalytics.ts';

export type ProviderRegistry = Record<DataSource, StockProvider>;

export interface StockService {
  /** Resolves a symbol's details (`GET /stock/{symbol}`). */
  lookup(symbol: string, source: DataSource): Promise<StockData>;
  /**
   * Resolves the "Past Performance" view for a symbol and period by calling
   * `GET /stock/{symbol}/historic?period=` and `GET /stock/{symbol}/highlow?period=` together.
   */
  performance(symbol: string, period: PerformancePeriod, source: DataSource): Promise<PastPerformance>;
}

export interface StockServiceOptions {
  formatLabel?: LabelFormatter;
}

export class InvalidSymbolError extends Error {
  constructor() {
    super('Please enter a stock symbol.');
    this.name = 'InvalidSymbolError';
  }
}

function requireSymbol(rawSymbol: string): string {
  const symbol = normalizeSymbol(rawSymbol);
  if (!symbol) throw new InvalidSymbolError();
  return symbol;
}

/**
 * Composes provider calls with the analytics layer. Providers are injected so
 * the service (and the UI above it) can be tested with fakes.
 */
export function createStockService(
  providers: ProviderRegistry,
  options: StockServiceOptions = {},
): StockService {
  return {
    async lookup(rawSymbol, source) {
      const symbol = requireSymbol(rawSymbol);
      const details = await providers[source].getDetails(symbol);
      return { symbol: details.symbol, details };
    },

    async performance(rawSymbol, period, source) {
      const symbol = requireSymbol(rawSymbol);
      const provider = providers[source];
      const [series, highLow] = await Promise.all([
        provider.getPriceSeries(symbol, period),
        provider.getHighLow(symbol, period),
      ]);
      return summarizePerformance(series, highLow, options.formatLabel);
    },
  };
}
