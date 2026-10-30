import { describe, expect, it } from 'vitest';
import type { Watchlist } from '../../types/watchlist.ts';
import { createMemoryWatchlistStore } from '../watchlistStore.ts';
import { createLocalWatchlistProvider, defaultNewWatchlistId } from './LocalWatchlistProvider.ts';
import { WatchlistNotFoundError } from './WatchlistProvider.ts';

const seed: Watchlist = { id: 'seed', name: 'Seed', symbols: ['AAPL', 'GOOG'] };
let n = 0;
const newId = () => `id-${++n}`;

describe('LocalWatchlistProvider', () => {
  it('lists what the store holds, and its summaries by id and name (the offline listing)', async () => {
    const provider = createLocalWatchlistProvider(createMemoryWatchlistStore([seed]), { newId });
    expect(await provider.list()).toEqual([seed]);
    expect(await provider.listSummaries()).toEqual([{ id: 'seed', name: 'Seed' }]);
  });

  it('creates with a generated id, newest first, and persists', async () => {
    const store = createMemoryWatchlistStore([seed]);
    const provider = createLocalWatchlistProvider(store, { newId });
    const created = await provider.create({ name: 'New', symbols: ['V'] });
    expect(created).toEqual({ id: expect.stringMatching(/^id-\d+$/), name: 'New', symbols: ['V'] });
    expect(store.load()).toEqual([created, seed]);
  });

  it('reads a list back as ticker-only entries (no details offline)', async () => {
    const provider = createLocalWatchlistProvider(createMemoryWatchlistStore([seed]));
    expect(await provider.get('seed')).toEqual({
      id: 'seed',
      name: 'Seed',
      entries: [
        { position: 1, ticker: 'AAPL' },
        { position: 2, ticker: 'GOOG' },
      ],
    });
  });

  it('updates in place and removes, persisting each', async () => {
    const store = createMemoryWatchlistStore([seed, { id: 'b', name: 'B', symbols: ['X'] }]);
    const provider = createLocalWatchlistProvider(store);
    await provider.update('seed', { name: 'Renamed', symbols: ['GOOG'] });
    expect(store.load()).toEqual([
      { id: 'seed', name: 'Renamed', symbols: ['GOOG'] },
      { id: 'b', name: 'B', symbols: ['X'] },
    ]);
    await provider.remove('seed');
    expect(store.load()).toEqual([{ id: 'b', name: 'B', symbols: ['X'] }]);
  });

  it('rejects unknown ids with WatchlistNotFoundError', async () => {
    const provider = createLocalWatchlistProvider(createMemoryWatchlistStore([seed]));
    await expect(provider.get('nope')).rejects.toBeInstanceOf(WatchlistNotFoundError);
    await expect(provider.update('nope', { name: 'x', symbols: ['A'] })).rejects.toBeInstanceOf(WatchlistNotFoundError);
    await expect(provider.remove('nope')).rejects.toBeInstanceOf(WatchlistNotFoundError);
  });

  it('default ids are unique', () => {
    expect(defaultNewWatchlistId()).not.toBe(defaultNewWatchlistId());
  });
});
