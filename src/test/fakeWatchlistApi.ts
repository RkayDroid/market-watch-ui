import { AxiosError, type AxiosResponse } from 'axios';
import detailAapl from '../../public/data/detail-AAPL.json';
import type { WatchlistHttpClient } from '../data/providers/LiveApiWatchlistProvider.ts';

export interface FakeWatchlistRecord {
  name: string;
  symbols: string[];
}

const http404 = () => new AxiosError('not found', undefined, undefined, undefined, { status: 404 } as AxiosResponse);

/**
 * In-memory stand-in for the watchlist API, speaking the documented contract:
 * `GET /user/{userId}/watchlists` lists ids and names (in insertion order), `POST` assigns
 * `srv-N` ids, `GET /watchlist/{id}` resolves AAPL to the captured `/stock` details and any
 * other ticker to an error entry, `PUT` replaces, `DELETE` removes; unknown ids 404.
 */
export function createFakeWatchlistApi(initial: Record<string, FakeWatchlistRecord> = {}) {
  const db: Record<string, FakeWatchlistRecord> = { ...initial };
  let next = 0;
  const calls: string[] = [];
  const idOf = (url: string) => decodeURIComponent(url.split('/').pop()!);

  const client: WatchlistHttpClient = {
    async get(url) {
      calls.push(`GET ${url}`);
      if (/\/user\/[^/]+\/watchlists$/.test(url)) {
        const watchlists = Object.entries(db).map(([watchListId, { name }]) => ({ watchListId, watchListName: name }));
        return { data: { userId: 'alice', count: watchlists.length, watchlists } };
      }
      const id = idOf(url);
      const list = db[id];
      if (!list) throw http404();
      const symbols = Object.fromEntries(
        list.symbols.map((ticker, i) => [
          String(i + 1),
          ticker === 'AAPL' ? detailAapl : { ticker, error: `Ticker ${ticker} not found.` },
        ]),
      );
      return {
        data: { watchListId: id, userId: 'alice', watchListName: list.name, count: list.symbols.length, symbols },
      };
    },
    async post(url, body) {
      calls.push(`POST ${url} ${JSON.stringify(body)}`);
      const { watchListName, symbols } = body as { watchListName: string; symbols: string[] };
      const id = `srv-${++next}`;
      db[id] = { name: watchListName, symbols };
      return { data: { userId: 'alice', watchListName, watchListId: id } };
    },
    async put(url, body) {
      calls.push(`PUT ${url} ${JSON.stringify(body)}`);
      const { watchListId, watchListName, symbols } = body as {
        watchListId: string;
        watchListName: string;
        symbols: string[];
      };
      if (!db[watchListId]) throw http404();
      db[watchListId] = { name: watchListName, symbols };
      return { data: '' };
    },
    async delete(url) {
      calls.push(`DELETE ${url}`);
      const id = idOf(url);
      if (!db[id]) throw http404();
      delete db[id];
      return { data: '' };
    },
  };
  return { client, calls, db };
}
