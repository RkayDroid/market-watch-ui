import type { Watchlist } from '../types/watchlist.ts';
import { InvalidPayloadError, isRecord, requiredString } from './payload.ts';

/**
 * Browser persistence of the user's watchlists (offline mode). Like the stock data, what
 * comes back from storage is untrusted: it is parsed with the same validators as an API
 * payload, and anything off-contract is dropped rather than crashing the page.
 */

const SUBJECT = 'watchlist';

/** `localStorage` key; bump the suffix if the persisted shape ever changes incompatibly. */
export const WATCHLISTS_STORAGE_KEY = 'market-watch.watchlists.v1';

/** Parses one persisted watchlist; throws {@link InvalidPayloadError} for anything malformed. */
export function parseWatchlist(payload: unknown): Watchlist {
  if (!isRecord(payload)) throw new InvalidPayloadError(SUBJECT, 'not an object');
  const id = requiredString(SUBJECT, payload.id, 'id');
  const name = requiredString(SUBJECT, payload.name, 'name');

  if (!Array.isArray(payload.symbols)) throw new InvalidPayloadError(SUBJECT, '"symbols" is not an array');
  const symbols = payload.symbols.map((s, i) => requiredString(SUBJECT, s, `symbols[${i}]`));
  if (symbols.length === 0) throw new InvalidPayloadError(SUBJECT, '"symbols" is empty');

  return { id, name, symbols };
}

/**
 * Parses the persisted collection. Tolerant at the collection level: an entry that fails to
 * parse, or a duplicate id, is skipped so one bad record can't hide the rest; a payload
 * that is not an array at all yields an empty list.
 */
export function parseWatchlists(payload: unknown): Watchlist[] {
  if (!Array.isArray(payload)) return [];
  const seen = new Set<string>();
  const lists: Watchlist[] = [];
  for (const entry of payload) {
    try {
      const list = parseWatchlist(entry);
      if (seen.has(list.id)) continue;
      seen.add(list.id);
      lists.push(list);
    } catch (err) {
      if (!(err instanceof InvalidPayloadError)) throw err;
    }
  }
  return lists;
}

/** Synchronous persistence of the whole collection, used by the offline {@link WatchlistProvider}. */
export interface WatchlistStore {
  load(): Watchlist[];
  save(lists: readonly Watchlist[]): void;
}

/** Store over a Web Storage object (`localStorage`); unreadable JSON is treated as empty. */
export function createStorageWatchlistStore(
  storage: Pick<Storage, 'getItem' | 'setItem'>,
  key: string = WATCHLISTS_STORAGE_KEY,
): WatchlistStore {
  return {
    load() {
      const raw = storage.getItem(key);
      if (!raw) return [];
      try {
        return parseWatchlists(JSON.parse(raw));
      } catch {
        return [];
      }
    },
    save(lists) {
      storage.setItem(key, JSON.stringify(lists));
    },
  };
}

/** In-memory store for tests and for environments without Web Storage. */
export function createMemoryWatchlistStore(initial: readonly Watchlist[] = []): WatchlistStore {
  let lists: Watchlist[] = [...initial];
  return {
    load: () => [...lists],
    save(next) {
      lists = [...next];
    },
  };
}

/** `localStorage` when the browser allows it (private mode and sandboxed frames may not), else memory. */
export function createDefaultWatchlistStore(): WatchlistStore {
  try {
    const storage = globalThis.localStorage;
    if (!storage) return createMemoryWatchlistStore();
    // Touching storage can throw (e.g. SecurityError); probe before committing to it.
    storage.getItem(WATCHLISTS_STORAGE_KEY);
    return createStorageWatchlistStore(storage);
  } catch {
    return createMemoryWatchlistStore();
  }
}
