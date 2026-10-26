import type { PriceRecord, StockDetails } from '../../types/stock.ts';

/**
 * Abstraction over a source of stock data (live API, offline JSON fixtures, ...).
 *
 * Details are mandatory — a source that cannot resolve them must reject with
 * {@link SymbolNotFoundError}. Historic prices are optional and currently provided
 * by no source: `GET /stock/{symbol}` carries none, and the history endpoint is not
 * wired up yet. A provider that gains history implements `getPrices` (records
 * sorted oldest → newest) and the "Past Performance" chart and table light up.
 */
export interface StockProvider {
  /** Resolves reference data for a (normalised, upper-case) symbol. */
  getDetails(symbol: string): Promise<StockDetails>;
  /** Resolves the hourly price series (oldest → newest), or `[]` when the source has none. */
  getPrices?(symbol: string): Promise<PriceRecord[]>;
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
