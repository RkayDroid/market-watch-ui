import { AxiosError, type AxiosResponse } from 'axios';
import { describe, expect, it, vi } from 'vitest';
import type { LiveApiConfig } from '../../config/liveApiConfig.ts';
import { createFakeWatchlistApi } from '../../test/fakeWatchlistApi.ts';
import {
  buildUserWatchlistsUrl,
  buildWatchlistCollectionUrl,
  buildWatchlistUrl,
  createLiveApiWatchlistProvider,
  toWatchlistApiError,
  type WatchlistHttpClient,
} from './LiveApiWatchlistProvider.ts';
import { LiveApiError } from './StockProvider.ts';
import { WatchlistNotFoundError } from './WatchlistProvider.ts';

const config: LiveApiConfig = { baseUrl: 'https://api.test/v1/', apiKey: 'secret', timeoutMs: 500, userId: 'alice' };

const http404 = () => new AxiosError('nf', undefined, undefined, undefined, { status: 404 } as AxiosResponse);
const fakeServer = createFakeWatchlistApi;

describe('URL builders', () => {
  it('build the collection and item URLs without doubled slashes', () => {
    expect(buildWatchlistCollectionUrl('https://api.test/v1/')).toBe('https://api.test/v1/watchlist');
    expect(buildWatchlistUrl('https://api.test/v1', 'k3Zp9QaB')).toBe('https://api.test/v1/watchlist/k3Zp9QaB');
    expect(buildWatchlistUrl('https://api.test/v1', 'a b')).toBe('https://api.test/v1/watchlist/a%20b');
    expect(buildUserWatchlistsUrl('https://api.test/v1/', 'alice')).toBe('https://api.test/v1/user/alice/watchlists');
    expect(buildUserWatchlistsUrl('https://api.test/v1', 'a b')).toBe('https://api.test/v1/user/a%20b/watchlists');
  });
});

describe('LiveApiWatchlistProvider', () => {
  it('create POSTs the documented body with the configured user and bearer key', async () => {
    const { client, calls } = fakeServer();
    const spy = vi.spyOn(client, 'post');
    const provider = createLiveApiWatchlistProvider(config, { client });

    const created = await provider.create({ name: 'Tech', symbols: ['AAPL', 'MSFT'] });
    expect(created).toEqual({ id: 'srv-1', name: 'Tech', symbols: ['AAPL', 'MSFT'] });
    expect(calls[0]).toBe(
      'POST https://api.test/v1/watchlist {"userId":"alice","watchListName":"Tech","symbols":["AAPL","MSFT"]}',
    );
    expect(spy.mock.calls[0][2]).toMatchObject({
      headers: { Accept: 'application/json', Authorization: 'Bearer secret' },
      timeout: 500,
    });
  });

  it('get parses GET /watchlist/{id} into resolved entries', async () => {
    const { client } = fakeServer({ k1: { name: 'Tech', symbols: ['AAPL', 'NOPE'] } });
    const provider = createLiveApiWatchlistProvider(config, { client });
    const details = await provider.get('k1');
    expect(details.name).toBe('Tech');
    expect(details.entries[0]).toMatchObject({ position: 1, ticker: 'AAPL', details: { sector: 'Technology' } });
    expect(details.entries[1]).toEqual({ position: 2, ticker: 'NOPE', error: 'Ticker NOPE not found.' });
  });

  it('listSummaries GETs /user/{userId}/watchlists', async () => {
    const { client, calls } = fakeServer({
      k1: { name: 'One', symbols: ['AAPL'] },
      k2: { name: 'Two', symbols: ['NOPE'] },
    });
    const provider = createLiveApiWatchlistProvider(config, { client });
    expect(await provider.listSummaries()).toEqual([
      { id: 'k1', name: 'One' },
      { id: 'k2', name: 'Two' },
    ]);
    expect(calls).toEqual(['GET https://api.test/v1/user/alice/watchlists']);
  });

  it('list reads the listing, then each list for its symbols, skipping one that vanished meanwhile', async () => {
    const { client, calls, db } = fakeServer({
      k1: { name: 'One', symbols: ['AAPL'] },
      k2: { name: 'Two', symbols: ['NOPE'] },
    });
    const realGet = client.get;
    client.get = async (url, cfg) => {
      const result = await realGet(url, cfg);
      delete db.k2; // gone after the listing was served
      return result;
    };
    const provider = createLiveApiWatchlistProvider(config, { client });

    expect(await provider.list()).toEqual([{ id: 'k1', name: 'One', symbols: ['AAPL'] }]);
    expect(calls).toEqual([
      'GET https://api.test/v1/user/alice/watchlists',
      'GET https://api.test/v1/watchlist/k1',
      'GET https://api.test/v1/watchlist/k2',
    ]);
  });

  it('list fails as a whole when a list cannot be read for another reason', async () => {
    const { client } = fakeServer({ k1: { name: 'One', symbols: ['AAPL'] } });
    const realGet = client.get;
    client.get = async (url, cfg) => {
      if (url.endsWith('/watchlist/k1')) throw Object.assign(new AxiosError('refused'), { code: 'ECONNREFUSED' });
      return realGet(url, cfg);
    };
    await expect(createLiveApiWatchlistProvider(config, { client }).list()).rejects.toBeInstanceOf(LiveApiError);
  });

  it('update PUTs the full replacement; remove DELETEs', async () => {
    const { client, calls, db } = fakeServer({ k1: { name: 'One', symbols: ['AAPL'] } });
    const provider = createLiveApiWatchlistProvider(config, { client });

    await provider.update('k1', { name: 'Uno', symbols: ['GOOG', 'AAPL'] });
    expect(calls[0]).toBe(
      'PUT https://api.test/v1/watchlist {"watchListId":"k1","watchListName":"Uno","symbols":["GOOG","AAPL"]}',
    );
    expect(db.k1).toEqual({ name: 'Uno', symbols: ['GOOG', 'AAPL'] });

    await provider.remove('k1');
    expect(calls[1]).toBe('DELETE https://api.test/v1/watchlist/k1');
    expect(db.k1).toBeUndefined();
  });

  it('maps 404s to WatchlistNotFoundError and other failures to LiveApiError', async () => {
    const { client } = fakeServer();
    const provider = createLiveApiWatchlistProvider(config, { client });
    await expect(provider.get('nope')).rejects.toBeInstanceOf(WatchlistNotFoundError);
    await expect(provider.update('nope', { name: 'x', symbols: ['A'] })).rejects.toBeInstanceOf(WatchlistNotFoundError);
    await expect(provider.remove('nope')).rejects.toBeInstanceOf(WatchlistNotFoundError);

    const down: WatchlistHttpClient = {
      ...client,
      post: async () => {
        throw Object.assign(new AxiosError('refused'), { code: 'ECONNREFUSED' });
      },
    };
    const err = await createLiveApiWatchlistProvider(config, { client: down })
      .create({ name: 'T', symbols: ['A'] })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(LiveApiError);
    expect((err as LiveApiError).kind).toBe('unreachable');
  });

  it('flags an off-contract response as malformed', async () => {
    const client: WatchlistHttpClient = {
      ...fakeServer().client,
      post: async () => ({ data: { nope: true } }),
    };
    const err = await createLiveApiWatchlistProvider(config, { client })
      .create({ name: 'T', symbols: ['A'] })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(LiveApiError);
    expect((err as LiveApiError).kind).toBe('malformed');
    expect((err as Error).message).toMatch(/watchListId/);
  });

  it('toWatchlistApiError classifies timeouts and HTTP errors', () => {
    const timeout = toWatchlistApiError(Object.assign(new AxiosError('t'), { code: 'ECONNABORTED' }), 'x', 'u');
    expect((timeout as LiveApiError).kind).toBe('timeout');
    const http = toWatchlistApiError(
      new AxiosError('s', undefined, undefined, undefined, { status: 500 } as AxiosResponse),
      'x',
      'u',
    );
    expect((http as LiveApiError).kind).toBe('http');
    expect((http as LiveApiError).status).toBe(500);
    // A 404 with no id in play (e.g. on create) is an HTTP error, not "not found".
    expect((toWatchlistApiError(http404(), 'x', 'u') as LiveApiError).kind).toBe('http');
  });
});
