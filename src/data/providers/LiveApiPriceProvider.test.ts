import { AxiosError, type AxiosRequestConfig, type AxiosResponse } from 'axios';
import { describe, expect, it, vi } from 'vitest';
import {
  buildPricesUrl,
  createLiveApiPriceProvider,
  parseLiveApiResponse,
  toLiveApiError,
  type HttpClient,
} from './LiveApiPriceProvider.ts';
import { LiveApiError, SymbolNotFoundError } from './PriceProvider.ts';

const config = { baseUrl: 'https://api.test/v1', timeoutMs: 1234 };

const okPayload = {
  symbol: 'AAPL',
  prices: [
    { timestamp: '2026-10-21T16:00:00Z', price: 219.5 },
    { timestamp: '2026-10-21T15:00:00Z', price: 220.1 },
  ],
};

function axiosErr(init: { status?: number; code?: string }): AxiosError {
  const err = new AxiosError('boom', init.code);
  if (init.status !== undefined) {
    err.response = { status: init.status } as AxiosResponse;
  }
  return err;
}

function fakeClient(impl: (url: string) => Promise<unknown> | unknown) {
  const get = vi.fn<(url: string, config?: AxiosRequestConfig) => Promise<{ data: unknown }>>(
    async (url) => ({ data: await impl(url) }),
  );
  const client: HttpClient = { get };
  return { client, get };
}

describe('buildPricesUrl', () => {
  it('composes path, query and encodes the symbol', () => {
    expect(buildPricesUrl('https://api.test/v1', 'BRK.B')).toBe(
      'https://api.test/v1/prices/BRK.B?interval=1h&limit=24',
    );
    expect(buildPricesUrl('https://api.test/v1///', 'A B', { interval: '5m', limit: 10 })).toBe(
      'https://api.test/v1/prices/A%20B?interval=5m&limit=10',
    );
  });
});

describe('parseLiveApiResponse', () => {
  it('maps and sorts points chronologically', () => {
    expect(parseLiveApiResponse(okPayload, 'AAPL')).toEqual([
      { date: '2026-10-21T15:00:00.000Z', rate: 220.1 },
      { date: '2026-10-21T16:00:00.000Z', rate: 219.5 },
    ]);
  });

  it('coerces numeric strings for price', () => {
    const out = parseLiveApiResponse({ prices: [{ timestamp: '2026-10-21T15:00:00Z', price: '1.5' }] }, 'X');
    expect(out[0].rate).toBe(1.5);
  });

  it.each([
    ['null body', null, /not an object/],
    ['array body', [], /not an object/],
    ['missing prices', { symbol: 'X' }, /"prices" is not an array/],
    ['empty prices', { prices: [] }, /"prices" is empty/],
    ['non-object point', { prices: [1] }, /prices\[0\] is not an object/],
    ['bad timestamp', { prices: [{ timestamp: 'nope', price: 1 }] }, /prices\[0\]\.timestamp/],
    ['bad price', { prices: [{ timestamp: '2026-10-21T15:00:00Z', price: 'abc' }] }, /prices\[0\]\.price/],
  ])('rejects %s', (_name, payload, pattern) => {
    expect(() => parseLiveApiResponse(payload, 'X')).toThrow(LiveApiError);
    expect(() => parseLiveApiResponse(payload, 'X')).toThrow(pattern);
    try {
      parseLiveApiResponse(payload, 'X');
    } catch (e) {
      expect((e as LiveApiError).kind).toBe('malformed');
    }
  });
});

describe('toLiveApiError', () => {
  const url = 'https://api.test/v1/prices/X';

  it('maps 404 to SymbolNotFoundError', () => {
    const err = toLiveApiError(axiosErr({ status: 404 }), 'X', url);
    expect(err).toBeInstanceOf(SymbolNotFoundError);
    expect(err.message).toBe('Symbol "X" was not found in the live API.');
  });

  it('maps other HTTP statuses to kind=http with the status', () => {
    const err = toLiveApiError(axiosErr({ status: 503 }), 'X', url) as LiveApiError;
    expect(err).toBeInstanceOf(LiveApiError);
    expect(err.kind).toBe('http');
    expect(err.status).toBe(503);
    expect(err.message).toMatch(/HTTP 503/);
  });

  it.each(['ECONNABORTED', 'ETIMEDOUT'])('maps %s to kind=timeout', (code) => {
    const err = toLiveApiError(axiosErr({ code }), 'X', url) as LiveApiError;
    expect(err.kind).toBe('timeout');
  });

  it('maps network failures to kind=unreachable mentioning the url', () => {
    const err = toLiveApiError(axiosErr({ code: 'ERR_NETWORK' }), 'X', url) as LiveApiError;
    expect(err.kind).toBe('unreachable');
    expect(err.message).toBe(`Could not reach the live API at ${url}.`);
  });

  it('passes through already-typed errors and wraps unknown ones', () => {
    const typed = new LiveApiError('malformed', 'm');
    expect(toLiveApiError(typed, 'X', url)).toBe(typed);
    const wrapped = toLiveApiError(new Error('weird'), 'X', url) as LiveApiError;
    expect(wrapped).toBeInstanceOf(LiveApiError);
    expect(wrapped.kind).toBe('unreachable');
  });
});

describe('createLiveApiPriceProvider', () => {
  it('requests the built url with timeout and accept header, and returns parsed records', async () => {
    const { client, get } = fakeClient(() => okPayload);
    const provider = createLiveApiPriceProvider(config, { client });

    const records = await provider.getPrices('AAPL');

    expect(records.map((r) => r.rate)).toEqual([220.1, 219.5]);
    expect(get).toHaveBeenCalledWith('https://api.test/v1/prices/AAPL?interval=1h&limit=24', {
      headers: { Accept: 'application/json' },
      timeout: 1234,
    });
  });

  it('sends a bearer token when an api key is configured', async () => {
    const { client, get } = fakeClient(() => okPayload);
    await createLiveApiPriceProvider({ ...config, apiKey: 'k3y' }, { client }).getPrices('AAPL');

    expect(get.mock.calls[0][1]).toMatchObject({ headers: { Authorization: 'Bearer k3y' } });
  });

  it('honours custom query options', async () => {
    const { client, get } = fakeClient(() => okPayload);
    await createLiveApiPriceProvider(config, { client, query: { interval: '15m', limit: 8 } }).getPrices('V');
    expect(get.mock.calls[0][0]).toBe('https://api.test/v1/prices/V?interval=15m&limit=8');
  });

  it('translates transport errors into typed errors', async () => {
    const { client } = fakeClient(() => {
      throw axiosErr({ status: 404 });
    });
    await expect(createLiveApiPriceProvider(config, { client }).getPrices('ZZZZ')).rejects.toBeInstanceOf(
      SymbolNotFoundError,
    );
  });

  it('translates malformed payloads into LiveApiError', async () => {
    const { client } = fakeClient(() => ({ prices: 'nope' }));
    await expect(createLiveApiPriceProvider(config, { client }).getPrices('AAPL')).rejects.toMatchObject({
      name: 'LiveApiError',
      kind: 'malformed',
    });
  });

  it('uses the global axios instance by default and reports unreachable hosts', async () => {
    // 'http://127.0.0.1:9' — port 9 (discard) is closed, so the connection is refused immediately.
    const provider = createLiveApiPriceProvider({ baseUrl: 'http://127.0.0.1:9', timeoutMs: 2000 });
    const err = await provider.getPrices('AAPL').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(LiveApiError);
    expect((err as LiveApiError).kind).toBe('unreachable');
  });
});

