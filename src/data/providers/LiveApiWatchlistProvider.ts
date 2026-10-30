import axios, { isAxiosError, type AxiosRequestConfig } from 'axios';
import type { LiveApiConfig } from '../../config/liveApiConfig.ts';
import {
  toWatchlist,
  type NewWatchlist,
  type Watchlist,
  type WatchlistDetails,
  type WatchlistSummary,
} from '../../types/watchlist.ts';
import { InvalidPayloadError } from '../payload.ts';
import {
  buildCreateWatchlistRequest,
  buildUpdateWatchlistRequest,
  parseCreateWatchlistResponse,
  parseWatchlistDetails,
  parseWatchlistListing,
  toCreatedWatchlist,
} from '../watchlistPayload.ts';
import { LiveApiError } from './StockProvider.ts';
import { WatchlistNotFoundError, type WatchlistProvider } from './WatchlistProvider.ts';

/* ---------------------------------------------------------------------------
 * Watchlist API (shapes documented in src/data/watchlistPayload.ts)
 *
 *   GET    {baseUrl}/user/{userId}/watchlists   the user's lists by id and name
 *   POST   {baseUrl}/watchlist                  create → { watchListId, … }
 *   PUT    {baseUrl}/watchlist                  replace name + symbols → 200
 *   GET    {baseUrl}/watchlist/{id}             read, symbols resolved to stock details
 *   DELETE {baseUrl}/watchlist/{id}             → 200
 *   Authorization: Bearer {apiKey}              (only when configured)
 *   404 → unknown watchlist id
 * ------------------------------------------------------------------------- */

export const LIVE_WATCHLIST_SOURCE_LABEL = 'the watchlist API';

/** The HTTP verbs the provider needs; axios satisfies it. */
export interface WatchlistHttpClient {
  get(url: string, config?: AxiosRequestConfig): Promise<{ data: unknown }>;
  post(url: string, body: unknown, config?: AxiosRequestConfig): Promise<{ data: unknown }>;
  put(url: string, body: unknown, config?: AxiosRequestConfig): Promise<{ data: unknown }>;
  delete(url: string, config?: AxiosRequestConfig): Promise<{ data: unknown }>;
}

const trimBase = (baseUrl: string) => baseUrl.replace(/\/+$/, '');

/** `{base}/watchlist`. */
export function buildWatchlistCollectionUrl(baseUrl: string): string {
  return `${trimBase(baseUrl)}/watchlist`;
}

/** `{base}/watchlist/{id}`. */
export function buildWatchlistUrl(baseUrl: string, id: string): string {
  return `${buildWatchlistCollectionUrl(baseUrl)}/${encodeURIComponent(id)}`;
}

/** `{base}/user/{userId}/watchlists`. */
export function buildUserWatchlistsUrl(baseUrl: string, userId: string): string {
  return `${trimBase(baseUrl)}/user/${encodeURIComponent(userId)}/watchlists`;
}

/** Converts any thrown value from the HTTP layer into a typed, user-presentable error. */
export function toWatchlistApiError(err: unknown, what: string, url: string, id?: string): Error {
  if (err instanceof LiveApiError || err instanceof WatchlistNotFoundError) return err;

  if (err instanceof InvalidPayloadError) {
    return new LiveApiError(
      'malformed',
      `The watchlist API returned an unexpected response for ${what}: ${err.reason}.`,
      { url },
    );
  }

  if (isAxiosError(err)) {
    const status = err.response?.status;
    if (status === 404 && id !== undefined) return new WatchlistNotFoundError(id, LIVE_WATCHLIST_SOURCE_LABEL);
    if (status !== undefined) {
      return new LiveApiError('http', `The watchlist API responded with HTTP ${status} for ${what}.`, { status, url });
    }
    if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
      return new LiveApiError('timeout', `The watchlist API timed out for ${what}.`, { url });
    }
    return new LiveApiError('unreachable', `Could not reach the watchlist API at ${url}.`, { url });
  }

  return new LiveApiError('unreachable', `The watchlist API request for ${what} failed.`, { url });
}

export interface LiveApiWatchlistProviderOptions {
  /** Injected for tests; defaults to the global axios instance. */
  client?: WatchlistHttpClient;
}

/** {@link WatchlistProvider} over the watchlist API; configured like the stock API (`.env`). */
export function createLiveApiWatchlistProvider(
  config: LiveApiConfig,
  { client = axios }: LiveApiWatchlistProviderOptions = {},
): WatchlistProvider {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (config.apiKey) headers.Authorization = `Bearer ${config.apiKey}`;
  const requestConfig: AxiosRequestConfig = { headers, timeout: config.timeoutMs };

  async function listSummaries(): Promise<WatchlistSummary[]> {
    const url = buildUserWatchlistsUrl(config.baseUrl, config.userId);
    try {
      const response = await client.get(url, requestConfig);
      return parseWatchlistListing(response.data).watchlists;
    } catch (err) {
      throw toWatchlistApiError(err, `the watchlists of ${config.userId}`, url);
    }
  }

  async function get(id: string): Promise<WatchlistDetails> {
    const url = buildWatchlistUrl(config.baseUrl, id);
    try {
      const response = await client.get(url, requestConfig);
      return parseWatchlistDetails(response.data);
    } catch (err) {
      throw toWatchlistApiError(err, `watchlist ${id}`, url, id);
    }
  }

  return {
    listSummaries,
    get,

    /**
     * The listing gives ids and names only, so each list is read back for its symbols (in
     * parallel). A list that vanishes between the two calls is skipped rather than failing the lot.
     */
    async list(): Promise<Watchlist[]> {
      const summaries = await listSummaries();
      const results = await Promise.all(
        summaries.map(async ({ id }) => {
          try {
            return toWatchlist(await get(id));
          } catch (err) {
            if (err instanceof WatchlistNotFoundError) return null;
            throw err;
          }
        }),
      );
      return results.filter((list): list is Watchlist => list !== null);
    },

    async create(list: NewWatchlist): Promise<Watchlist> {
      const url = buildWatchlistCollectionUrl(config.baseUrl);
      try {
        const response = await client.post(url, buildCreateWatchlistRequest(config.userId, list), requestConfig);
        return toCreatedWatchlist(parseCreateWatchlistResponse(response.data), list);
      } catch (err) {
        throw toWatchlistApiError(err, `creating watchlist "${list.name}"`, url);
      }
    },

    async update(id, edit) {
      const url = buildWatchlistCollectionUrl(config.baseUrl);
      try {
        await client.put(url, buildUpdateWatchlistRequest(id, edit), requestConfig);
      } catch (err) {
        throw toWatchlistApiError(err, `updating watchlist ${id}`, url, id);
      }
    },

    async remove(id) {
      const url = buildWatchlistUrl(config.baseUrl, id);
      try {
        await client.delete(url, requestConfig);
      } catch (err) {
        throw toWatchlistApiError(err, `deleting watchlist ${id}`, url, id);
      }
    },
  };
}
