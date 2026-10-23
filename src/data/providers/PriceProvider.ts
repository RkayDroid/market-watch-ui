import type { PriceRecord } from '../../types/stock.ts';

/**
 * Abstraction over any source of hourly prices (flat file, live API, ...).
 * Implementations must return records sorted oldest → newest.
 */
export interface PriceProvider {
  /** Resolves price history for a (normalised, upper-case) symbol. */
  getPrices(symbol: string): Promise<PriceRecord[]>;
}

export interface SymbolNotFoundOptions {
  /** Human-readable description of the source, e.g. "the local data file". */
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

/** Raised when the live price API cannot be reached or returns something unusable. */
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
