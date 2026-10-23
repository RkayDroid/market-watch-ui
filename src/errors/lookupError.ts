import { LiveApiError, SymbolNotFoundError } from '../data/providers/PriceProvider.ts';
import { InvalidSymbolError } from '../services/stockService.ts';

/** A user-presentable description of why a lookup failed. */
export interface LookupError {
  title: string;
  message: string;
  /** Optional remediation advice shown beneath the message. */
  hint?: string;
  /** Symbols the user could try instead (e.g. from the flat file). */
  suggestedSymbols?: readonly string[];
}

export const GENERIC_LOOKUP_ERROR: LookupError = {
  title: 'Lookup failed',
  message: 'Failed to retrieve stock data.',
  hint: 'Please try again.',
};

const LIVE_API_TITLES: Record<LiveApiError['kind'], string> = {
  unreachable: 'Live API unreachable',
  timeout: 'Live API timed out',
  http: 'Live API error',
  malformed: 'Unexpected API response',
};

/** Maps any thrown value from the service layer into a {@link LookupError}. */
export function toLookupError(err: unknown): LookupError {
  if (err instanceof SymbolNotFoundError) {
    return {
      title: 'Symbol not found',
      message: `"${err.symbol}" is not available from this data source.`,
      hint: err.availableSymbols.length ? 'Try one of the available symbols:' : undefined,
      suggestedSymbols: err.availableSymbols.length ? err.availableSymbols : undefined,
    };
  }

  if (err instanceof LiveApiError) {
    return {
      title: err.status ? `${LIVE_API_TITLES[err.kind]} (HTTP ${err.status})` : LIVE_API_TITLES[err.kind],
      message: err.message,
      hint:
        err.kind === 'unreachable' || err.kind === 'timeout'
          ? 'Check VITE_LIVE_API_BASE_URL and your network connection, or switch to the local flat file.'
          : undefined,
    };
  }

  if (err instanceof InvalidSymbolError) {
    return { title: 'Symbol required', message: err.message };
  }

  if (err instanceof Error && err.message) {
    return { ...GENERIC_LOOKUP_ERROR, message: err.message };
  }

  return GENERIC_LOOKUP_ERROR;
}
