import type {
  NewWatchlist,
  Watchlist,
  WatchlistDetails,
  WatchlistEdit,
  WatchlistEntry,
  WatchlistSummary,
} from '../types/watchlist.ts';
import { InvalidPayloadError, isRecord, optionalNumber, optionalString, requiredString } from './payload.ts';
import { parseStockDetails } from './stockDetails.ts';

/* ---------------------------------------------------------------------------
 * Watchlist API contract
 *
 *   POST   /watchlist            { userId, watchListName, symbols[] }
 *                                → { userId, watchListName, watchListId }
 *   PUT    /watchlist            { watchListId, watchListName, symbols[] }      → 200
 *   GET    /watchlist/{id}       → { watchListId, userId, watchListName, count,
 *                                    symbols: { "1": <stock details | { ticker, error }>, "2": … } }
 *   DELETE /watchlist/{id}       → 200
 *   GET    /user/{userId}/watchlists
 *                                → { userId, count, watchlists: [ { watchListId, watchListName }, … ] }
 *
 * The request builders and response parsers below are the only places that know the
 * server's field names; the rest of the app speaks `Watchlist` / `WatchlistDetails`.
 * ------------------------------------------------------------------------- */

const SUBJECT = 'watchlist';
const SUBJECT_LISTING = 'watchlist listing';

export interface CreateWatchlistRequest {
  userId: string;
  watchListName: string;
  symbols: string[];
}

export interface UpdateWatchlistRequest {
  watchListId: string;
  watchListName: string;
  symbols: string[];
}

/** Body of `POST /watchlist`. Symbols are sent normalised, so the server's own casing cannot differ. */
export function buildCreateWatchlistRequest(userId: string, list: NewWatchlist): CreateWatchlistRequest {
  return { userId, watchListName: list.name, symbols: [...list.symbols] };
}

/** Body of `PUT /watchlist`: a full replacement of the name and symbols. */
export function buildUpdateWatchlistRequest(id: string, edit: WatchlistEdit): UpdateWatchlistRequest {
  return { watchListId: id, watchListName: edit.name, symbols: [...edit.symbols] };
}

export interface CreatedWatchlist {
  id: string;
  userId?: string;
  name: string;
}

/** `POST /watchlist` response → the id the server assigned (and the name as it stored it). */
export function parseCreateWatchlistResponse(payload: unknown): CreatedWatchlist {
  if (!isRecord(payload)) throw new InvalidPayloadError(SUBJECT, 'not an object');
  return {
    id: requiredString(SUBJECT, payload.watchListId, 'watchListId'),
    userId: optionalString(SUBJECT, payload.userId, 'userId'),
    name: requiredString(SUBJECT, payload.watchListName, 'watchListName'),
  };
}

/** The created list as the client will show it: the server's id and name, the symbols it was sent. */
export function toCreatedWatchlist(created: CreatedWatchlist, sent: NewWatchlist): Watchlist {
  return { id: created.id, name: created.name, symbols: [...sent.symbols] };
}

function parseEntry(position: number, value: unknown): WatchlistEntry {
  const field = `symbols["${position}"]`;
  if (!isRecord(value)) throw new InvalidPayloadError(SUBJECT, `${field} is not an object`);
  const error = optionalString(SUBJECT, value.error, `${field}.error`);
  if (error !== undefined) {
    return { position, ticker: requiredString(SUBJECT, value.ticker, `${field}.ticker`), error };
  }
  const details = parseStockDetails(value);
  return { position, ticker: details.symbol, details };
}

/**
 * `GET /watchlist/{id}` response → {@link WatchlistDetails}. The `symbols` map is keyed by
 * 1-based position; entries are returned sorted by it. `count`, when present, must match.
 */
export function parseWatchlistDetails(payload: unknown): WatchlistDetails {
  if (!isRecord(payload)) throw new InvalidPayloadError(SUBJECT, 'not an object');
  const id = requiredString(SUBJECT, payload.watchListId, 'watchListId');
  const userId = optionalString(SUBJECT, payload.userId, 'userId');
  const name = requiredString(SUBJECT, payload.watchListName, 'watchListName');

  const symbols = payload.symbols ?? {};
  if (!isRecord(symbols)) throw new InvalidPayloadError(SUBJECT, '"symbols" is not an object');

  const entries = Object.entries(symbols)
    .map(([key, value]) => {
      const position = Number(key);
      if (!Number.isInteger(position) || position < 1) {
        throw new InvalidPayloadError(SUBJECT, `"symbols" key "${key}" is not a position`);
      }
      return parseEntry(position, value);
    })
    .sort((a, b) => a.position - b.position);

  const count = optionalNumber(SUBJECT, payload.count, 'count');
  if (count !== undefined && count !== entries.length) {
    throw new InvalidPayloadError(SUBJECT, `"count" is ${count} but ${entries.length} symbols were served`);
  }

  return { id, userId, name, entries };
}

export interface WatchlistListing {
  userId?: string;
  /** In the order served. */
  watchlists: WatchlistSummary[];
}

/**
 * `GET /user/{userId}/watchlists` response → the user's lists by id and name (symbols come from
 * `GET /watchlist/{id}`). `count`, when present, must match the number of entries.
 */
export function parseWatchlistListing(payload: unknown): WatchlistListing {
  if (!isRecord(payload)) throw new InvalidPayloadError(SUBJECT_LISTING, 'not an object');
  const userId = optionalString(SUBJECT_LISTING, payload.userId, 'userId');
  const raw = payload.watchlists ?? [];
  if (!Array.isArray(raw)) throw new InvalidPayloadError(SUBJECT_LISTING, '"watchlists" is not an array');

  const seen = new Set<string>();
  const watchlists = raw.map((entry, i): WatchlistSummary => {
    const field = `watchlists[${i}]`;
    if (!isRecord(entry)) throw new InvalidPayloadError(SUBJECT_LISTING, `${field} is not an object`);
    const id = requiredString(SUBJECT_LISTING, entry.watchListId, `${field}.watchListId`);
    if (seen.has(id)) throw new InvalidPayloadError(SUBJECT_LISTING, `watchlist id "${id}" is listed twice`);
    seen.add(id);
    return { id, name: requiredString(SUBJECT_LISTING, entry.watchListName, `${field}.watchListName`) };
  });

  const count = optionalNumber(SUBJECT_LISTING, payload.count, 'count');
  if (count !== undefined && count !== watchlists.length) {
    throw new InvalidPayloadError(
      SUBJECT_LISTING,
      `"count" is ${count} but ${watchlists.length} watchlists were listed`,
    );
  }
  return { userId, watchlists };
}
