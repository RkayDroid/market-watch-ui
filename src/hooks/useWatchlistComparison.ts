import { useCallback, useEffect, useRef, useState } from 'react';
import { toLookupError, type LookupError } from '../errors/lookupError.ts';
import type { StockService } from '../services/stockService.ts';
import type { PerformancePeriod } from '../types/performance.ts';
import type { DataSource, PastPerformance, StockDetails } from '../types/stock.ts';
import { withMinimumDuration } from '../utils/timing.ts';
import { DEFAULT_MIN_LOADING_MS } from './useStockLookup.ts';

/** One symbol's side of a comparison: its details and performance, or why they could not be fetched. */
export interface SymbolComparison {
  symbol: string;
  details?: StockDetails;
  performance?: PastPerformance;
  error?: LookupError;
}

export interface WatchlistComparisonState {
  /** In watchlist order; `null` until Compare has been clicked. */
  results: SymbolComparison[] | null;
  loading: boolean;
  pendingPeriod: PerformancePeriod | null;
}

export interface UseWatchlistComparisonResult extends WatchlistComparisonState {
  /** Fetches details and past performance for every symbol (in parallel); a failure only affects its own symbol. */
  compare: (
    symbols: readonly string[],
    period: PerformancePeriod,
    source: DataSource,
    referenceDate?: string,
  ) => Promise<void>;
  /** Clears results and any in-flight request (e.g. when the period or date changes). */
  reset: () => void;
}

export interface UseWatchlistComparisonOptions {
  minLoadingMs?: number;
}

const IDLE: WatchlistComparisonState = { results: null, loading: false, pendingPeriod: null };

async function compareSymbol(
  service: StockService,
  symbol: string,
  period: PerformancePeriod,
  source: DataSource,
  referenceDate?: string,
): Promise<SymbolComparison> {
  try {
    const [lookup, performance] = await Promise.all([
      service.lookup(symbol, source),
      service.performance(symbol, period, source, referenceDate),
    ]);
    return { symbol, details: lookup.details, performance };
  } catch (err) {
    return { symbol, error: toLookupError(err) };
  }
}

/**
 * Async state of a watchlist comparison: the same request the Analysis view makes for one
 * symbol (`/stock` + `/historic`), made for every symbol of a list at once. Mirrors
 * {@link usePerformanceLookup}: only the most recent request may update state.
 */
export function useWatchlistComparison(
  service: StockService,
  { minLoadingMs = DEFAULT_MIN_LOADING_MS }: UseWatchlistComparisonOptions = {},
): UseWatchlistComparisonResult {
  const [state, setState] = useState<WatchlistComparisonState>(IDLE);
  const requestId = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const reset = useCallback(() => {
    requestId.current++;
    setState(IDLE);
  }, []);

  const compare = useCallback(
    async (symbols: readonly string[], period: PerformancePeriod, source: DataSource, referenceDate?: string) => {
      const id = ++requestId.current;
      const isCurrent = () => mounted.current && id === requestId.current;

      setState({ results: null, loading: true, pendingPeriod: period });
      const results = await withMinimumDuration(
        Promise.all(symbols.map((symbol) => compareSymbol(service, symbol, period, source, referenceDate))),
        minLoadingMs,
      );
      if (isCurrent()) setState({ results, loading: false, pendingPeriod: null });
    },
    [service, minLoadingMs],
  );

  return { ...state, compare, reset };
}
