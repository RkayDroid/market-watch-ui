import { describe, expect, it, vi } from 'vitest';
import type { Watchlist } from '../types/watchlist.ts';
import { InvalidPayloadError } from './payload.ts';
import {
  createDefaultWatchlistStore,
  createMemoryWatchlistStore,
  createStorageWatchlistStore,
  parseWatchlist,
  parseWatchlists,
  WATCHLISTS_STORAGE_KEY,
} from './watchlistStore.ts';

const valid: Watchlist = { id: 'a', name: 'Tech', symbols: ['AAPL', 'GOOG'] };

describe('parseWatchlist', () => {
  it('accepts a well-formed record, ignoring fields it does not know (e.g. the old createdAt)', () => {
    expect(parseWatchlist(valid)).toEqual(valid);
    expect(parseWatchlist({ ...valid, createdAt: '2026-01-01T00:00:00.000Z' })).toEqual(valid);
  });

  it.each([
    ['not an object', 'x'],
    ['missing id', { ...valid, id: undefined }],
    ['blank name', { ...valid, name: '  ' }],
    ['symbols not an array', { ...valid, symbols: 'AAPL' }],
    ['empty symbols', { ...valid, symbols: [] }],
    ['non-string symbol', { ...valid, symbols: ['AAPL', 3] }],
  ])('rejects %s', (_label, payload) => {
    expect(() => parseWatchlist(payload)).toThrow(InvalidPayloadError);
  });
});

describe('parseWatchlists', () => {
  it('returns an empty list for anything that is not an array', () => {
    expect(parseWatchlists(null)).toEqual([]);
    expect(parseWatchlists({})).toEqual([]);
    expect(parseWatchlists('[]')).toEqual([]);
  });

  it('skips malformed entries and duplicate ids but keeps the rest, in order', () => {
    const other = { ...valid, id: 'b', name: 'Other' };
    expect(parseWatchlists([valid, { junk: true }, { ...valid, name: 'dupe id' }, other])).toEqual([valid, other]);
  });
});

describe('createStorageWatchlistStore', () => {
  function fakeStorage(initial: Record<string, string> = {}) {
    const data = { ...initial };
    return {
      getItem: vi.fn((k: string) => data[k] ?? null),
      setItem: vi.fn((k: string, v: string) => {
        data[k] = v;
      }),
      data,
    };
  }

  it('round-trips through JSON under the versioned key', () => {
    const storage = fakeStorage();
    const store = createStorageWatchlistStore(storage);
    store.save([valid]);
    expect(storage.setItem).toHaveBeenCalledWith(WATCHLISTS_STORAGE_KEY, JSON.stringify([valid]));
    expect(store.load()).toEqual([valid]);
  });

  it('treats a missing or corrupt value as "no watchlists"', () => {
    expect(createStorageWatchlistStore(fakeStorage()).load()).toEqual([]);
    expect(createStorageWatchlistStore(fakeStorage({ [WATCHLISTS_STORAGE_KEY]: '{not json' })).load()).toEqual([]);
    expect(createStorageWatchlistStore(fakeStorage({ [WATCHLISTS_STORAGE_KEY]: '{"a":1}' })).load()).toEqual([]);
  });

  it('honours a custom key', () => {
    const storage = fakeStorage();
    createStorageWatchlistStore(storage, 'custom').save([]);
    expect(storage.data).toEqual({ custom: '[]' });
  });
});

describe('createMemoryWatchlistStore', () => {
  it('keeps what was saved and hands out copies', () => {
    const store = createMemoryWatchlistStore([valid]);
    const loaded = store.load();
    loaded.pop();
    expect(store.load()).toEqual([valid]);
    store.save([]);
    expect(store.load()).toEqual([]);
  });
});

describe('createDefaultWatchlistStore', () => {
  it('uses localStorage when available', () => {
    localStorage.setItem(WATCHLISTS_STORAGE_KEY, JSON.stringify([valid]));
    try {
      expect(createDefaultWatchlistStore().load()).toEqual([valid]);
    } finally {
      localStorage.removeItem(WATCHLISTS_STORAGE_KEY);
    }
  });

  it('falls back to memory when storage throws', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    try {
      const store = createDefaultWatchlistStore();
      store.save([valid]);
      expect(store.load()).toEqual([valid]);
    } finally {
      spy.mockRestore();
    }
  });
});
