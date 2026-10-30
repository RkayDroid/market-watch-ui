import type {
  NewWatchlist,
  Watchlist,
  WatchlistDetails,
  WatchlistEdit,
  WatchlistSummary,
} from '../../types/watchlist.ts';

/**
 * Abstraction over where watchlists live: the watchlist API, or the browser (offline).
 * Inputs arrive validated and normalised (see `watchlistService.ts`); a provider only
 * stores and retrieves. An unknown id must reject with {@link WatchlistNotFoundError}.
 */
export interface WatchlistProvider {
  /** The user's watchlists by id and name — `GET /user/{userId}/watchlists` — in the order served. */
  listSummaries(): Promise<WatchlistSummary[]>;
  /** Every watchlist with its symbols: the summaries, each read with {@link get}. */
  list(): Promise<Watchlist[]>;
  /** One watchlist with its symbols resolved — `GET /watchlist/{id}`. */
  get(id: string): Promise<WatchlistDetails>;
  /** Stores a new list and returns it with its assigned id — `POST /watchlist`. */
  create(list: NewWatchlist): Promise<Watchlist>;
  /** Replaces the name and symbols of an existing list — `PUT /watchlist`. */
  update(id: string, edit: WatchlistEdit): Promise<void>;
  /** `DELETE /watchlist/{id}`. */
  remove(id: string): Promise<void>;
}

export class WatchlistNotFoundError extends Error {
  readonly id: string;

  constructor(id: string, source: string) {
    super(`Watchlist "${id}" was not found in ${source}.`);
    this.name = 'WatchlistNotFoundError';
    this.id = id;
  }
}
