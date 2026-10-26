import { AxiosError, type AxiosRequestConfig, type AxiosResponse } from 'axios';
import { describe, expect, it, vi } from 'vitest';
import detailAapl from '../../../json/detail-AAPL.json';
import highLowWeek from '../../../json/highlow-AAPL-WEEK.json';
import historyWeek from '../../../json/history-AAPL-WEEK.json';
import { parseStockDetails } from '../stockDetails.ts';
import {
  buildHighLowUrl,
  buildHistoricUrl,
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

/** Routes the three endpoints to the captured AAPL payloads. */
function aaplApi(url: string): unknown {
  if (url === 'https://api.test/v1/stock/AAPL') return detailAapl;
  if (url === 'https://api.test/v1/stock/AAPL/historic?period=WEEK') return historyWeek;
  if (url === 'https://api.test/v1/stock/AAPL/highlow?period=WEEK') return highLowWeek;
  throw axiosErr({ status: 404 });
}

describe('url builders', () => {
  it('compose the /stock/{symbol} family of urls and encode the symbol', () => {
    expect(buildStockUrl('https://api.test/v1', 'AAPL')).toBe('https://api.test/v1/stock/AAPL');
    expect(buildStockUrl('https://api.test/v1///', 'A B')).toBe('https://api.test/v1/stock/A%20B');
    expect(buildHistoricUrl('https://api.test/v1', 'BRK.B', 'HALF_YEAR')).toBe(
      'https://api.test/v1/stock/BRK.B/historic?period=HALF_YEAR',
    );
    expect(buildHighLowUrl('https://api.test/v1/', 'AAPL', 'FIVE_YEAR')).toBe(
      'https://api.test/v1/stock/AAPL/highlow?period=FIVE_YEAR',
    );
  });
});

describe('parseLiveApiResponse', () => {
  it('returns the parser result for a valid payload', () => {
    expect(parseLiveApiResponse(parseStockDetails, detailAapl, 'AAPL')).toMatchObject({ displayName: 'Apple' });
  });

  it('wraps contract violations as kind=malformed, naming the payload type', () => {
    let caught: unknown;
    try {
      parseLiveApiResponse(parseStockDetails, { sector: 'X' }, 'X');
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(LiveApiError);
    expect((caught as LiveApiError).kind).toBe('malformed');
    expect((caught as LiveApiError).message).toBe(
      'The live API returned an unexpected stock details response for X: "symbol" is missing.',
    );
  });

  it('lets unrelated errors through untouched', () => {
    const boom = new Error('boom');
    expect(() =>
      parseLiveApiResponse(() => {
        throw boom;
      }, {}, 'X'),
    ).toThrow(boom);
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
  it('getDetails requests GET {base}/stock/{symbol} with timeout and accept header', async () => {
    const { client, get } = fakeClient(aaplApi);
    const provider = createLiveApiStockProvider(config, { client });

    const details = await provider.getDetails('AAPL');

    expect(details).toMatchObject({ symbol: 'AAPL', displayName: 'Apple', fulldayPrice: 347.725 });
    expect(get).toHaveBeenCalledWith('https://api.test/v1/stock/AAPL', {
      headers: { Accept: 'application/json' },
      timeout: 1234,
    });
  });

  it('getPriceSeries requests GET {base}/stock/{symbol}/historic?period= and parses the series', async () => {
    const { client, get } = fakeClient(aaplApi);
    const series = await createLiveApiStockProvider(config, { client }).getPriceSeries('AAPL', 'WEEK');

    expect(get.mock.calls[0][0]).toBe('https://api.test/v1/stock/AAPL/historic?period=WEEK');
    expect(series).toMatchObject({ symbol: 'AAPL', period: 'WEEK', interval: '1d' });
    expect(series.records).toHaveLength(5);
  });

  it('getHighLow requests GET {base}/stock/{symbol}/highlow?period= and parses the figures', async () => {
    const { client, get } = fakeClient(aaplApi);
    const highLow = await createLiveApiStockProvider(config, { client }).getHighLow('AAPL', 'WEEK');

    expect(get.mock.calls[0][0]).toBe('https://api.test/v1/stock/AAPL/highlow?period=WEEK');
    expect(highLow).toEqual({
      symbol: 'AAPL',
      period: 'WEEK',
      high: { price: 351.73, occurredAt: '2026-10-23T09:30:00-04:00' },
      low: { price: 338.7, occurredAt: '2026-10-20T09:30:00-04:00' },
    });
  });

  it('rejects a series or high/low for a different symbol or period than requested', async () => {
    const { client } = fakeClient(aaplApi);
    const provider = createLiveApiStockProvider(config, { client });
    // Route the MONTH url to the WEEK capture.
    const { client: mismatched } = fakeClient((url) => aaplApi(url.replace('MONTH', 'WEEK')));
    await expect(createLiveApiStockProvider(config, { client: mismatched }).getPriceSeries('AAPL', 'MONTH')).rejects.toMatchObject({
      kind: 'malformed',
      message: 'The live API returned an unexpected price history response for AAPL: "period" is WEEK, expected MONTH.',
    });
    await expect(provider.getHighLow('AAPL', 'YEAR')).rejects.toBeInstanceOf(SymbolNotFoundError); // 404 in the fake
  });

  it('sends a bearer token when an api key is configured', async () => {
    const { client, get } = fakeClient(aaplApi);
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
