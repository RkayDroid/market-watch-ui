import type { StockDetails } from './stock.ts';

/**
 * A named, ordered set of ticker symbols the user wants quick access to. Mirrors the
 * watchlist API (`POST/PUT/GET/DELETE /watchlist`): the server's `watchListId` /
 * `watchListName` are `id` / `name` here. Offline, the same shape is kept in the browser.
 */
export interface Watchlist {
  /** Server-assigned identifier (client-generated offline), e.g. "k3Zp9QaB". */
  id: string;
  /** User-chosen display name, trimmed, unique among the user's watchlists (case-insensitive). */
  name: string;
  /** Normalised (upper-case) symbols in order, without duplicates. Never empty. */
  symbols: string[];
}

/** A watchlist as the listing endpoint names it (`GET /user/{userId}/watchlists`): id and name, no symbols. */
export interface WatchlistSummary {
  id: string;
  name: string;
}

/** What the user fills in to create a watchlist; validated and normalised by the service. */
export interface WatchlistDraft {
  name: string;
  /** Free text: symbols separated by commas, spaces or new lines. */
  symbolsText: string;
}

/** The validated content of a new watchlist — what `POST /watchlist` sends (plus the user). */
export interface NewWatchlist {
  name: string;
  symbols: string[];
}

/** What the user can change on an existing watchlist — the body of `PUT /watchlist`. */
export interface WatchlistEdit {
  name: string;
  /** Normalised symbols in the new order; same rules as at creation (non-empty, unique, at most the limit). */
  symbols: string[];
}

/** One symbol of a watchlist as served by `GET /watchlist/{id}`: resolved details, or why it could not be. */
export interface WatchlistEntry {
  /** 1-based position in the list. */
  position: number;
  ticker: string;
  details?: StockDetails;
  /** Server-side resolution failure, e.g. "Ticker NOPE not found." */
  error?: string;
}

/** A watchlist as read back from the server, with each symbol resolved. */
export interface WatchlistDetails {
  id: string;
  userId?: string;
  name: string;
  entries: WatchlistEntry[];
}

/** The plain {@link Watchlist} behind a {@link WatchlistDetails}. */
export function toWatchlist(details: WatchlistDetails): Watchlist {
  return { id: details.id, name: details.name, symbols: details.entries.map((entry) => entry.ticker) };
}

export const WATCHLIST_NAME_MAX_LENGTH = 40;
export const WATCHLIST_MAX_SYMBOLS = 20;

/**
 * Shape of a ticker symbol as the providers accept it: letters, digits, and the `.`/`-`
 * class separators (`BRK.A`, `BRK-A`), 1–10 characters. Matched against the normalised form.
 */
export const SYMBOL_PATTERN = /^[A-Z0-9][A-Z0-9.-]{0,9}$/;
