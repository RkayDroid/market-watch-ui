import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { StockService } from '../services/stockService.ts';
import type { StockData } from '../types/stock.ts';
import { useStockLookup } from './useStockLookup.ts';

const stock = (symbol: string): StockData => ({
  symbol,
  currentPrice: 1,
  highPrice: 1,
  lowPrice: 1,
  changePercent: 0,
  history: [],
});

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const instant = { minLoadingMs: 0 };

afterEach(() => vi.useRealTimers());

describe('useStockLookup', () => {
  it('transitions idle → loading → data', async () => {
    const d = deferred<StockData>();
    const service: StockService = { lookup: () => d.promise };
    const { result } = renderHook(() => useStockLookup(service, instant));

    expect(result.current).toMatchObject({ data: null, loading: false, pendingSymbol: null, error: null });

    act(() => {
      void result.current.lookup(' v ', 'file');
    });
    expect(result.current.loading).toBe(true);
    expect(result.current.pendingSymbol).toBe('V');

    await act(async () => {
      d.resolve(stock('V'));
      await d.promise;
    });
    expect(result.current).toMatchObject({ loading: false, pendingSymbol: null, error: null });
    expect(result.current.data?.symbol).toBe('V');
  });

  it('clears previous results as soon as a new lookup starts', async () => {
    const second = deferred<StockData>();
    let call = 0;
    const service: StockService = { lookup: async () => (++call === 1 ? stock('V') : second.promise) };
    const { result } = renderHook(() => useStockLookup(service, instant));

    await act(() => result.current.lookup('V', 'file'));
    expect(result.current.data?.symbol).toBe('V');

    act(() => {
      void result.current.lookup('AAPL', 'file');
    });
    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(true);
  });

  it('exposes a structured error and clears data', async () => {
    const service: StockService = {
      lookup: async (symbol) => {
        if (symbol === 'BAD') throw new Error('Something specific');
        return stock(symbol);
      },
    };
    const { result } = renderHook(() => useStockLookup(service, instant));

    await act(() => result.current.lookup('V', 'file'));
    await act(() => result.current.lookup('BAD', 'file'));

    expect(result.current.error).toMatchObject({ title: 'Lookup failed', message: 'Something specific' });
    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBeNull();
  });

  it('keeps loading for at least minLoadingMs even when the source is instant', async () => {
    vi.useFakeTimers();
    const service: StockService = { lookup: async (s) => stock(s) };
    const { result } = renderHook(() => useStockLookup(service, { minLoadingMs: 1000 }));

    act(() => {
      void result.current.lookup('V', 'file');
    });
    await act(() => vi.advanceTimersByTimeAsync(900));
    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();

    await act(() => vi.advanceTimersByTimeAsync(100));
    expect(result.current.loading).toBe(false);
    expect(result.current.data?.symbol).toBe('V');
  });

  it('ignores out-of-order responses from superseded requests', async () => {
    const first = deferred<StockData>();
    const second = deferred<StockData>();
    let call = 0;
    const service: StockService = { lookup: () => (++call === 1 ? first.promise : second.promise) };
    const { result } = renderHook(() => useStockLookup(service, instant));

    act(() => {
      void result.current.lookup('A', 'api');
      void result.current.lookup('B', 'api');
    });

    await act(async () => {
      second.resolve(stock('B'));
      await second.promise;
    });
    await waitFor(() => expect(result.current.data?.symbol).toBe('B'));

    await act(async () => {
      first.resolve(stock('A'));
      await first.promise;
    });
    expect(result.current.data?.symbol).toBe('B');
    expect(result.current.loading).toBe(false);
  });
});
