import { useCallback, useEffect, useRef, useState } from 'react';
import { toLookupError, type LookupError } from '../errors/lookupError.ts';
import type { StockService } from '../services/stockService.ts';
import type { PerformancePeriod } from '../types/performance.ts';
import type { DataSource, PastPerformance } from '../types/stock.ts';
import { withMinimumDuration } from '../utils/timing.ts';
import { DEFAULT_MIN_LOADING_MS } from './useStockLookup.ts';

export interface PerformanceLookupState {
  data: PastPerformance | null;
  loading: boolean;
  /** Period of the in-flight request, for the loading indicator. */
  pendingPeriod: PerformancePeriod | null;
  error: LookupError | null;
}

export interface UsePerformanceLookupResult extends PerformanceLookupState {
  fetch: (symbol: string, period: PerformancePeriod, source: DataSource) => Promise<void>;
  /** Clears results, errors and any in-flight request (e.g. when a different symbol is looked up). */
  reset: () => void;
}

export interface UsePerformanceLookupOptions {
  minLoadingMs?: number;
}

const IDLE: PerformanceLookupState = { data: null, loading: false, pendingPeriod: null, error: null };

/**
 * Manages the async lifecycle of the "Past Performance" fetch (historic + high/low).
 * Mirrors {@link useStockLookup}: only the most recent request may update state.
 */
export function usePerformanceLookup(
  service: StockService,
  { minLoadingMs = DEFAULT_MIN_LOADING_MS }: UsePerformanceLookupOptions = {},
): UsePerformanceLookupResult {
  const [state, setState] = useState<PerformanceLookupState>(IDLE);
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

  const fetch = useCallback(
    async (symbol: string, period: PerformancePeriod, source: DataSource) => {
      const id = ++requestId.current;
      const isCurrent = () => mounted.current && id === requestId.current;

      setState({ ...IDLE, loading: true, pendingPeriod: period });

      try {
        const data = await withMinimumDuration(service.performance(symbol, period, source), minLoadingMs);
        if (isCurrent()) setState({ ...IDLE, data });
      } catch (err) {
        if (isCurrent()) setState({ ...IDLE, error: toLookupError(err) });
      }
    },
    [service, minLoadingMs],
  );

  return { ...state, fetch, reset };
}
