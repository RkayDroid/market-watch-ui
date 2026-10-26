import type { PerformancePeriod } from '../../types/performance.ts';
import type { HighLow, PriceSeries, StockDetails } from '../../types/stock.ts';

/**
 * Abstraction over a source of stock data (live API, offline JSON fixtures, ...).
 * Symbols are normalised (upper-case) before they reach a provider. A source that
 * cannot resolve a symbol must reject with {@link SymbolNotFoundError}.
 */
export interface StockProvider {
  /** Reference data — `GET /stock/{symbol}`. */
  getDetails(symbol: string): Promise<StockDetails>;
  /** Sampled prices over a look-back period — `GET /stock/{symbol}/historic?period=`. */
  getPriceSeries(symbol: string, period: PerformancePeriod): Promise<PriceSeries>;
  /** Highest and lowest price over a look-back period — `GET /stock/{symbol}/highlow?period=`. */
  getHighLow(symbol: string, period: PerformancePeriod): Promise<HighLow>;
}

export interface SymbolNotFoundOptions {
  /** Human-readable description of the source, e.g. "the live API". */
  source: string;
  /** Symbols the source does know about, if it can enumerate them. */
  availableSymbols?: readonly string[];
}

export class SymbolNotFoundError extends Error {
  readonly symbol: string;
  readonly availableSymbols: readonly string[];

  constructor(symbol: string, { source, availableSymbols = [] }: SymbolNotFoundOptions) {
    const available = availableSymbols.length
      ? ` Available symbols: ${availableSymbols.join(', ')}.`
      : '';
    super(`Symbol "${symbol}" was not found in ${source}.${available}`);
    this.name = 'SymbolNotFoundError';
    this.symbol = symbol;
    this.availableSymbols = availableSymbols;
  }
}

export type LiveApiFailureKind = 'unreachable' | 'timeout' | 'http' | 'malformed';

/** Raised when the live stock API cannot be reached or returns something unusable. */
export class LiveApiError extends Error {
  readonly kind: LiveApiFailureKind;
  readonly status?: number;
  readonly url?: string;

  constructor(kind: LiveApiFailureKind, message: string, details: { status?: number; url?: string } = {}) {
    super(message);
    this.name = 'LiveApiError';
    this.kind = kind;
    this.status = details.status;
    this.url = details.url;
  }
}
