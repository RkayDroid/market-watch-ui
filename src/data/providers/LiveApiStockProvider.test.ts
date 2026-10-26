import { AxiosError, type AxiosRequestConfig, type AxiosResponse } from 'axios';
import { describe, expect, it, vi } from 'vitest';
import detailAapl from '../../../json/detail-AAPL.json';
import {
  buildStockUrl,
  createLiveApiStockProvider,
  parseLiveApiResponse,
  toLiveApiError,
  type HttpClient,
} from './LiveApiStockProvider.ts';
import { LiveApiError, SymbolNotFoundError } from './StockProvider.ts';

const config = { baseUrl: 'https://api.test/v1', timeoutMs: 1234 };

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

describe('buildStockUrl', () => {
  it('composes the /stock/{symbol} path and encodes the symbol', () => {
    expect(buildStockUrl('https://api.test/v1', 'AAPL')).toBe('https://api.test/v1/stock/AAPL');
    expect(buildStockUrl('https://api.test/v1///', 'A B')).toBe('https://api.test/v1/stock/A%20B');
  });

  it('sends no query string — the endpoint has no interval/limit', () => {
    expect(buildStockUrl('https://api.test/v1', 'BRK.B')).not.toContain('?');
  });
});

describe('parseLiveApiResponse', () => {
  it('maps the captured live payload', () => {
    expect(parseLiveApiResponse(detailAapl, 'AAPL')).toEqual({
      symbol: 'AAPL',
      displayName: 'Apple',
      longName: 'Apple Inc.',
      sector: 'Technology',
      exchange: 'NMS',
      market: 'us_market',
      currency: 'USD',
      language: 'en-US',
      fulldayPrice: 347.725,
    });
  });

  it.each([
    ['null body', null, /not an object/],
    ['array body', [], /not an object/],
    ['missing symbol', { sector: 'X' }, /"symbol" is missing/],
    ['bad price', { symbol: 'X', fulldayPrice: 'abc' }, /"fulldayPrice" is not a number/],
  ])('rejects %s as kind=malformed', (_name, payload, pattern) => {
    let caught: unknown;
    try {
      parseLiveApiResponse(payload, 'X');
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(LiveApiError);
    expect((caught as LiveApiError).kind).toBe('malformed');
    expect((caught as LiveApiError).message).toMatch(/^The live API returned an unexpected response for X: /);
    expect((caught as LiveApiError).message).toMatch(pattern);
  });
});

describe('toLiveApiError', () => {
  const url = 'https://api.test/v1/stock/X';

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

describe('createLiveApiStockProvider', () => {
  it('requests GET {base}/stock/{symbol} with timeout and accept header, and returns parsed details', async () => {
    const { client, get } = fakeClient(() => detailAapl);
    const provider = createLiveApiStockProvider(config, { client });

    const details = await provider.getDetails('AAPL');

    expect(details).toMatchObject({ symbol: 'AAPL', displayName: 'Apple', fulldayPrice: 347.725 });
    expect(get).toHaveBeenCalledWith('https://api.test/v1/stock/AAPL', {
      headers: { Accept: 'application/json' },
      timeout: 1234,
    });
  });

  it('has no price history — the endpoint does not provide any', () => {
    const { client } = fakeClient(() => detailAapl);
    expect(createLiveApiStockProvider(config, { client }).getPrices).toBeUndefined();
  });

  it('sends a bearer token when an api key is configured', async () => {
    const { client, get } = fakeClient(() => detailAapl);
    await createLiveApiStockProvider({ ...config, apiKey: 'k3y' }, { client }).getDetails('AAPL');

    expect(get.mock.calls[0][1]).toMatchObject({ headers: { Authorization: 'Bearer k3y' } });
  });

  it('translates transport errors into typed errors', async () => {
    const { client } = fakeClient(() => {
      throw axiosErr({ status: 404 });
    });
    await expect(createLiveApiStockProvider(config, { client }).getDetails('ZZZZ')).rejects.toBeInstanceOf(
      SymbolNotFoundError,
    );
  });

  it('translates malformed payloads into LiveApiError', async () => {
    const { client } = fakeClient(() => ({ prices: [] }));
    await expect(createLiveApiStockProvider(config, { client }).getDetails('AAPL')).rejects.toMatchObject({
      name: 'LiveApiError',
      kind: 'malformed',
    });
  });

  it('uses the global axios instance by default and reports unreachable hosts', async () => {
    // 'http://127.0.0.1:9' — port 9 (discard) is closed, so the connection is refused immediately.
    const provider = createLiveApiStockProvider({ baseUrl: 'http://127.0.0.1:9', timeoutMs: 2000 });
    const err = await provider.getDetails('AAPL').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(LiveApiError);
    expect((err as LiveApiError).kind).toBe('unreachable');
  });
});
