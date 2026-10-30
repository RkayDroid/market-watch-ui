import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SymbolNotFoundError } from '../data/providers/StockProvider.ts';
import type { StockService } from '../services/stockService.ts';
import type { PastPerformance, StockData } from '../types/stock.ts';
import { useWatchlistComparison } from './useWatchlistComparison.ts';

const perf = (symbol: string): PastPerformance => ({
  symbol,
  period: 'WEEK',
  interval: '1d',
  latestPrice: 10,
  changePercent: 1,
  points: [{ label: 'd1', open: 9, high: 11, low: 8, price: 10, trend: 'up' }],
  high: { price: 11, occurredAt: 'd1' },
  low: { price: 8, occurredAt: 'd1' },
});
const stock = (symbol: string): StockData => ({
  symbol,
  details: { symbol, displayName: `${symbol} Inc`, currency: 'USD' },
});

function service(failing: string[] = []): StockService {
  const fail = (symbol: string) => {
    if (failing.includes(symbol)) throw new SymbolNotFoundError(symbol, { source: 'the offline data' });
  };
  return {
    lookup: vi.fn(async (symbol) => {
      fail(symbol);
      return stock(symbol);
    }),
    performance: vi.fn(async (symbol) => {
      fail(symbol);
      return perf(symbol);
    }),
  };
}

const instant = { minLoadingMs: 0 };

describe('useWatchlistComparison', () => {
  it('starts idle and fetches details + performance for every symbol, in list order', async () => {
    const svc = service();
    const { result } = renderHook(() => useWatchlistComparison(svc, instant));
    expect(result.current).toMatchObject({ results: null, loading: false, pendingPeriod: null });

    act(() => {
      void result.current.compare(['AAPL', 'GOOG'], 'WEEK', 'local', '2026-02-02');
    });
    expect(result.current.loading).toBe(true);
    expect(result.current.pendingPeriod).toBe('WEEK');

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.results?.map((r) => r.symbol)).toEqual(['AAPL', 'GOOG']);
    expect(result.current.results?.[0].details?.displayName).toBe('AAPL Inc');
    expect(result.current.results?.[0].performance?.symbol).toBe('AAPL');
    expect(svc.performance).toHaveBeenCalledWith('GOOG', 'WEEK', 'local', '2026-02-02');
    expect(svc.lookup).toHaveBeenCalledWith('GOOG', 'local');
  });

  it('keeps a failing symbol as its own error without failing the others', async () => {
    const { result } = renderHook(() => useWatchlistComparison(service(['NOPE']), instant));
    await act(() => result.current.compare(['AAPL', 'NOPE'], 'DAY', 'local'));
    expect(result.current.results?.[0].performance).toBeDefined();
    expect(result.current.results?.[1]).toMatchObject({ symbol: 'NOPE', error: { title: 'Symbol not found' } });
    expect(result.current.results?.[1].performance).toBeUndefined();
  });

  it('reset clears results and ignores a request still in flight', async () => {
    let release!: () => void;
    const svc: StockService = {
      lookup: async (symbol) => stock(symbol),
      performance: () => new Promise((resolve) => (release = () => resolve(perf('AAPL')))),
    };
    const { result } = renderHook(() => useWatchlistComparison(svc, instant));
    act(() => {
      void result.current.compare(['AAPL'], 'DAY', 'local');
    });
    act(() => result.current.reset());
    expect(result.current).toMatchObject({ results: null, loading: false });
    await act(async () => release());
    expect(result.current.results).toBeNull();
  });
});
