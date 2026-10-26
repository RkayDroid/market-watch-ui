import { useCallback, useEffect, useRef, useState } from 'react';
import { toLookupError, type LookupError } from '../errors/lookupError.ts';
import type { StockService } from '../services/stockService.ts';
import type { DataSource, StockData } from '../types/stock.ts';
import { withMinimumDuration } from '../utils/timing.ts';

export interface StockLookupState {
  data: StockData | null;
  /** Source `data` was loaded from, so follow-up requests (e.g. past performance) use the same one. */
  source: DataSource | null;
  loading: boolean;
  /** Symbol (as typed) of the in-flight request, for the loading indicator. */
  pendingSymbol: string | null;
  error: LookupError | null;
}

export interface UseStockLookupResult extends StockLookupState {
  lookup: (symbol: string, source: DataSource) => Promise<void>;
}

export interface UseStockLookupOptions {
  /** Loading state is shown for at least this long, so fast sources still give feedback. */
  minLoadingMs?: number;
}

export const DEFAULT_MIN_LOADING_MS = 1000;

const IDLE: StockLookupState = { data: null, source: null, loading: false, pendingSymbol: null, error: null };

/**
 * Manages the async lifecycle of a stock lookup. Starting a lookup clears previous
 * results; only the most recent request is allowed to update state, so rapid
 * successive lookups can't race.
 */
export function useStockLookup(
  service: StockService,
  { minLoadingMs = DEFAULT_MIN_LOADING_MS }: UseStockLookupOptions = {},
): UseStockLookupResult {
  const [state, setState] = useState<StockLookupState>(IDLE);
  const requestId = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const lookup = useCallback(
    async (symbol: string, source: DataSource) => {
      const id = ++requestId.current;
      const isCurrent = () => mounted.current && id === requestId.current;

      setState({ ...IDLE, loading: true, pendingSymbol: symbol.trim().toUpperCase() });

      try {
        const data = await withMinimumDuration(service.lookup(symbol, source), minLoadingMs);
        if (isCurrent()) setState({ ...IDLE, data, source });
      } catch (err) {
        if (isCurrent()) setState({ ...IDLE, error: toLookupError(err) });
      }
    },
    [service, minLoadingMs],
  );

  return { ...state, lookup };
}
