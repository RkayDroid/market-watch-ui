import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createLocalWatchlistProvider } from '../data/providers/LocalWatchlistProvider.ts';
import type { WatchlistProvider } from '../data/providers/WatchlistProvider.ts';
import { createMemoryWatchlistStore } from '../data/watchlistStore.ts';
import { LiveApiError } from '../data/providers/StockProvider.ts';
import { InvalidWatchlistError } from '../services/watchlistService.ts';
import type { Watchlist } from '../types/watchlist.ts';
import { useWatchlists } from './useWatchlists.ts';

const seed: Watchlist = { id: 'seed', name: 'Seed', symbols: ['AAPL'] };
let n = 0;
const newId = () => `id-${++n}`;

function localProvider(lists: Watchlist[] = [seed]) {
  const store = createMemoryWatchlistStore(lists);
  return { store, provider: createLocalWatchlistProvider(store, { newId }) };
}

describe('useWatchlists', () => {
  it('loads from the provider on mount', async () => {
    const { provider } = localProvider();
    const { result } = renderHook(() => useWatchlists(provider));
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.watchlists).toEqual([seed]);
    expect(result.current.error).toBeNull();
  });

  it('reloads when the provider changes, ignoring a slower earlier load', async () => {
    const { provider: a } = localProvider([{ id: 'a', name: 'A', symbols: ['X'] }]);
    let release!: () => void;
    const slow: WatchlistProvider = {
      ...a,
      list: () => new Promise((resolve) => (release = () => resolve([{ id: 'slow', name: 'Slow', symbols: ['Y'] }]))),
    };
    const { provider: b } = localProvider([{ id: 'b', name: 'B', symbols: ['Z'] }]);

    const { result, rerender } = renderHook(({ p }) => useWatchlists(p), { initialProps: { p: slow } });
    rerender({ p: b });
    await waitFor(() => expect(result.current.watchlists.map((l) => l.id)).toEqual(['b']));
    await act(async () => release());
    expect(result.current.watchlists.map((l) => l.id)).toEqual(['b']);
  });

  it('does not touch the provider until enabled, then loads once and keeps the lists when disabled again', async () => {
    const { provider } = localProvider();
    const spy = vi.spyOn(provider, 'list');
    const { result, rerender } = renderHook(({ enabled }) => useWatchlists(provider, { enabled }), {
      initialProps: { enabled: false },
    });
    expect(result.current.loading).toBe(false);
    expect(spy).not.toHaveBeenCalled();

    rerender({ enabled: true });
    await waitFor(() => expect(result.current.watchlists).toEqual([seed]));
    rerender({ enabled: false });
    rerender({ enabled: true });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(result.current.watchlists).toEqual([seed]);
  });

  it('reports a failed load as an error', async () => {
    const broken: WatchlistProvider = {
      ...localProvider().provider,
      list: async () => {
        throw new LiveApiError('unreachable', 'Could not reach the watchlist API.');
      },
    };
    const { result } = renderHook(() => useWatchlists(broken));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toMatchObject({ title: 'Live API unreachable' });
    expect(result.current.watchlists).toEqual([]);
  });

  it('creates from a draft through the provider, newest first', async () => {
    const { store, provider } = localProvider();
    const { result } = renderHook(() => useWatchlists(provider));
    await waitFor(() => expect(result.current.loading).toBe(false));

    let created: Watchlist | undefined;
    await act(async () => {
      created = await result.current.create({ name: 'New', symbolsText: 'goog meta' });
    });
    expect(created).toEqual({ id: expect.stringMatching(/^id-/), name: 'New', symbols: ['GOOG', 'META'] });
    expect(result.current.watchlists.map((l) => l.name)).toEqual(['New', 'Seed']);
    expect(store.load().map((l) => l.name)).toEqual(['New', 'Seed']);
  });

  it('rejects an invalid draft before touching the provider', async () => {
    const { provider } = localProvider();
    const spy = vi.spyOn(provider, 'create');
    const { result } = renderHook(() => useWatchlists(provider));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await expect(result.current.create({ name: 'seed', symbolsText: 'X' })).rejects.toBeInstanceOf(
      InvalidWatchlistError,
    );
    expect(spy).not.toHaveBeenCalled();
    expect(result.current.watchlists).toEqual([seed]);
  });

  it('updates through the provider and reflects the trimmed edit', async () => {
    const { store, provider } = localProvider([seed, { id: 'b', name: 'B', symbols: ['X', 'Y'] }]);
    const { result } = renderHook(() => useWatchlists(provider));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(() => result.current.update('b', { name: ' Bee ', symbols: ['Y', 'X'] }));
    expect(result.current.watchlists[1]).toEqual({ id: 'b', name: 'Bee', symbols: ['Y', 'X'] });
    expect(store.load()[1]).toEqual({ id: 'b', name: 'Bee', symbols: ['Y', 'X'] });

    await expect(result.current.update('b', { name: 'seed', symbols: ['Y'] })).rejects.toBeInstanceOf(
      InvalidWatchlistError,
    );
    await expect(result.current.update('nope', { name: 'N', symbols: ['Y'] })).rejects.toThrow(/no longer exists/);
  });

  it('removes through the provider, or reports the failure in error', async () => {
    const { store, provider } = localProvider();
    const { result } = renderHook(() => useWatchlists(provider));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(() => result.current.remove('seed'));
    expect(result.current.watchlists).toEqual([]);
    expect(store.load()).toEqual([]);

    await act(() => result.current.remove('seed'));
    expect(result.current.error).toMatchObject({ title: 'Watchlist not found' });
  });
});
