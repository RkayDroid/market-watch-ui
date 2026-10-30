import type {
  NewWatchlist,
  Watchlist,
  WatchlistDetails,
  WatchlistEdit,
  WatchlistSummary,
} from '../../types/watchlist.ts';
import { createDefaultWatchlistStore, type WatchlistStore } from '../watchlistStore.ts';
import { WatchlistNotFoundError, type WatchlistProvider } from './WatchlistProvider.ts';

export const LOCAL_WATCHLIST_SOURCE_LABEL = 'this browser';

/** Default id source: the Web Crypto UUID, with a time+random fallback for older runtimes. */
export function defaultNewWatchlistId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return `wl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export interface LocalWatchlistProviderOptions {
  /** Produces ids for new lists (the server does this online). Injectable for tests. */
  newId?: () => string;
}

/**
 * Offline {@link WatchlistProvider}: the whole collection lives in a {@link WatchlistStore}
 * (`localStorage` by default). `get` resolves no stock details — offline, a watchlist is
 * just its tickers; each is looked up on its own when clicked.
 */
export function createLocalWatchlistProvider(
  store: WatchlistStore,
  { newId = defaultNewWatchlistId }: LocalWatchlistProviderOptions = {},
): WatchlistProvider {
  function find(id: string): { lists: Watchlist[]; index: number } {
    const lists = store.load();
    const index = lists.findIndex((list) => list.id === id);
    if (index < 0) throw new WatchlistNotFoundError(id, LOCAL_WATCHLIST_SOURCE_LABEL);
    return { lists, index };
  }

  return {
    /** The offline counterpart of `GET /user/{userId}/watchlists`: what is stored, by id and name. */
    async listSummaries(): Promise<WatchlistSummary[]> {
      return store.load().map(({ id, name }) => ({ id, name }));
    },
    async list() {
      return store.load();
    },
    async get(id): Promise<WatchlistDetails> {
      const { lists, index } = find(id);
      const list = lists[index];
      return {
        id: list.id,
        name: list.name,
        entries: list.symbols.map((ticker, i) => ({ position: i + 1, ticker })),
      };
    },
    async create(list: NewWatchlist): Promise<Watchlist> {
      const created: Watchlist = { id: newId(), name: list.name, symbols: [...list.symbols] };
      store.save([created, ...store.load()]);
      return created;
    },
    async update(id, edit: WatchlistEdit) {
      const { lists, index } = find(id);
      lists[index] = { ...lists[index], name: edit.name, symbols: [...edit.symbols] };
      store.save(lists);
    },
    async remove(id) {
      const { lists, index } = find(id);
      lists.splice(index, 1);
      store.save(lists);
    },
  };
}

/** Default offline provider wired to `localStorage` (memory when unavailable). */
export function createDefaultLocalWatchlistProvider(): WatchlistProvider {
  return createLocalWatchlistProvider(createDefaultWatchlistStore());
}
