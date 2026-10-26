import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { StockService } from '../services/stockService.ts';
import type { PastPerformance } from '../types/stock.ts';
import { usePerformanceLookup } from './usePerformanceLookup.ts';

const perf = (period: PastPerformance['period']): PastPerformance => ({
  symbol: 'AAPL',
  period,
  interval: '1d',
  latestPrice: 1,
  changePercent: 0,
  points: [],
  high: { price: 1, occurredAt: '2026-10-19' },
  low: { price: 1, occurredAt: '2026-10-19' },
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (err: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function service(performance: StockService['performance']): StockService {
  return { lookup: vi.fn(), performance };
}

describe('usePerformanceLookup', () => {
  it('starts idle, shows the pending period while loading, then exposes the data', async () => {
    const d = deferred<PastPerformance>();
    const performance = vi.fn(() => d.promise);
    const { result } = renderHook(() => usePerformanceLookup(service(performance), { minLoadingMs: 0 }));

    expect(result.current).toMatchObject({ data: null, loading: false, pendingPeriod: null, error: null });

    act(() => {
      void result.current.fetch('AAPL', 'WEEK', 'api');
    });
    expect(result.current).toMatchObject({ loading: true, pendingPeriod: 'WEEK' });
    expect(performance).toHaveBeenCalledWith('AAPL', 'WEEK', 'api');

    d.resolve(perf('WEEK'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data?.period).toBe('WEEK');
    expect(result.current.error).toBeNull();
  });

  it('maps failures to a presentable error and clears previous data', async () => {
    const performance = vi
      .fn<StockService['performance']>()
      .mockResolvedValueOnce(perf('DAY'))
      .mockRejectedValueOnce(new Error('historic down'));
    const { result } = renderHook(() => usePerformanceLookup(service(performance), { minLoadingMs: 0 }));

    await act(() => result.current.fetch('AAPL', 'DAY', 'api'));
    expect(result.current.data).not.toBeNull();

    await act(() => result.current.fetch('AAPL', 'DAY', 'api'));
    expect(result.current.data).toBeNull();
    expect(result.current.error).toMatchObject({ title: 'Lookup failed', message: 'historic down' });
  });

  it('ignores the result of a superseded request', async () => {
    const first = deferred<PastPerformance>();
    const second = deferred<PastPerformance>();
    const performance = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const { result } = renderHook(() => usePerformanceLookup(service(performance), { minLoadingMs: 0 }));

    act(() => {
      void result.current.fetch('AAPL', 'DAY', 'api');
      void result.current.fetch('AAPL', 'YEAR', 'api');
    });
    second.resolve(perf('YEAR'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    first.resolve(perf('DAY'));
    await new Promise((r) => setTimeout(r, 0));

    expect(result.current.data?.period).toBe('YEAR');
  });

  it('reset clears state and discards an in-flight request', async () => {
    const d = deferred<PastPerformance>();
    const { result } = renderHook(() => usePerformanceLookup(service(() => d.promise), { minLoadingMs: 0 }));

    act(() => {
      void result.current.fetch('AAPL', 'DAY', 'api');
    });
    act(() => result.current.reset());
    expect(result.current).toMatchObject({ data: null, loading: false, pendingPeriod: null, error: null });

    d.resolve(perf('DAY'));
    await new Promise((r) => setTimeout(r, 0));
    expect(result.current.data).toBeNull();
  });
});
