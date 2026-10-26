import axios, { AxiosError, type AxiosResponse } from 'axios';
import { afterEach, describe, expect, it, vi } from 'vitest';
import detailAapl from '../../../json/detail-AAPL.json';
import highLowMonth from '../../../json/highlow-AAPL-MONTH.json';
import historyMonth from '../../../json/history-AAPL-MONTH.json';
import {
  createDefaultLocalStockProvider,
  createHttpJsonLoader,
  createLocalStockProvider,
  localDetailsPath,
  localHighLowPath,
  localHistoricPath,
  OFFLINE_SYMBOLS,
  type JsonLoader,
} from './LocalStockProvider.ts';
import { SymbolNotFoundError } from './StockProvider.ts';

vi.mock('axios', async (importOriginal) => {
  const actual = await importOriginal<typeof import('axios')>();
  return { ...actual, default: { ...actual.default, get: vi.fn() } };
});

afterEach(() => vi.restoreAllMocks());

/** Response headers of a JSON fixture served by a static host. */
const json = { 'content-type': 'application/json; charset=utf-8' };

const FILES: Record<string, unknown> = {
  'data/detail-AAPL.json': detailAapl,
  'data/detail-TSLA.json': { symbol: 'TSLA', sector: 'Consumer Cyclical' },
  'data/historic-AAPL-MONTH.json': historyMonth,
  'data/highlow-AAPL-MONTH.json': highLowMonth,
};

const loader: JsonLoader = async (path) => FILES[path] ?? null;

describe('fixture paths', () => {
  it('mirror the live endpoints', () => {
    expect(localDetailsPath('AAPL')).toBe('data/detail-AAPL.json');
    expect(localHistoricPath('AAPL', 'HALF_YEAR')).toBe('data/historic-AAPL-HALF_YEAR.json');
    expect(localHighLowPath('BRK.B', 'DAY')).toBe('data/highlow-BRK.B-DAY.json');
    expect(localDetailsPath('A B')).toBe('data/detail-A%20B.json');
  });
});

describe('createLocalStockProvider', () => {
  it('serves details parsed from the JSON fixture', async () => {
    const provider = createLocalStockProvider(loader);
    expect(await provider.getDetails('AAPL')).toMatchObject({ symbol: 'AAPL', displayName: 'Apple' });
    expect(await provider.getDetails('TSLA')).toEqual({ symbol: 'TSLA', sector: 'Consumer Cyclical' });
  });

  it('serves the price series and high/low for a period from their fixtures', async () => {
    const provider = createLocalStockProvider(loader);
    const series = await provider.getPriceSeries('AAPL', 'MONTH');
    expect(series).toMatchObject({ symbol: 'AAPL', period: 'MONTH', interval: '1d' });
    expect(series.records).toHaveLength(20);

    expect(await provider.getHighLow('AAPL', 'MONTH')).toEqual({
      symbol: 'AAPL',
      period: 'MONTH',
      high: { price: 351.73, occurredAt: '2026-10-23' },
      low: { price: 325.81, occurredAt: '2026-10-01' },
    });
  });

  it('rejects symbols without a fixture, suggesting the shipped offline symbols', async () => {
    const err = await createLocalStockProvider(loader).getDetails('NOPE').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SymbolNotFoundError);
    expect((err as SymbolNotFoundError).availableSymbols).toEqual(OFFLINE_SYMBOLS);
    expect((err as Error).message).toBe(
      'Symbol "NOPE" was not found in the offline data. Available symbols: AAPL, GOOG, META.',
    );
  });

  it('rejects a period without a fixture the same way', async () => {
    const provider = createLocalStockProvider(loader);
    await expect(provider.getPriceSeries('AAPL', 'YEAR')).rejects.toBeInstanceOf(SymbolNotFoundError);
    await expect(provider.getHighLow('TSLA', 'MONTH')).rejects.toBeInstanceOf(SymbolNotFoundError);
  });

  it('accepts a custom list of available symbols', async () => {
    const provider = createLocalStockProvider(loader, { availableSymbols: ['X', 'Y'] });
    const err = await provider.getDetails('NOPE').catch((e: unknown) => e);
    expect((err as SymbolNotFoundError).availableSymbols).toEqual(['X', 'Y']);
  });

  it('reports malformed fixture files with the path and reason', async () => {
    const provider = createLocalStockProvider(async () => ({ sector: 'no symbol here' }));
    await expect(provider.getDetails('AAPL')).rejects.toThrow(
      'The offline file data/detail-AAPL.json is malformed: "symbol" is missing.',
    );
    await expect(provider.getHighLow('AAPL', 'DAY')).rejects.toThrow(
      'The offline file data/highlow-AAPL-DAY.json is malformed: "high" is missing.',
    );
  });

  it('propagates loader failures other than not-found', async () => {
    const provider = createLocalStockProvider(async () => {
      throw new Error('disk on fire');
    });
    await expect(provider.getDetails('AAPL')).rejects.toThrow('disk on fire');
  });
});

describe('createHttpJsonLoader', () => {
  it('fetches the path relative to the base url as JSON', async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: detailAapl, headers: json });
    const load = createHttpJsonLoader('/app');

    expect(await load('data/detail-AAPL.json')).toBe(detailAapl);
    expect(axios.get).toHaveBeenCalledWith('/app/data/detail-AAPL.json', {
      headers: { Accept: 'application/json' },
    });
  });

  it('does not double up the slash when the base already ends with one', async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: {}, headers: json });
    await createHttpJsonLoader('/')('data/x.json');
    expect(vi.mocked(axios.get).mock.calls[0][0]).toBe('/data/x.json');
  });

  it('maps a 404 to null', async () => {
    vi.mocked(axios.get).mockRejectedValue(
      new AxiosError('nf', undefined, undefined, undefined, { status: 404 } as AxiosResponse),
    );
    expect(await createHttpJsonLoader('/')('data/x.json')).toBeNull();
  });

  it('treats a non-JSON 200 (SPA fallback page) as "no file"', async () => {
    vi.mocked(axios.get).mockResolvedValue({
      data: '<!doctype html><html></html>',
      headers: { 'content-type': 'text/html' },
    });
    expect(await createHttpJsonLoader('/')('data/x.json')).toBeNull();
  });

  it('rethrows other HTTP failures', async () => {
    vi.mocked(axios.get).mockRejectedValue(
      new AxiosError('boom', undefined, undefined, undefined, { status: 500 } as AxiosResponse),
    );
    await expect(createHttpJsonLoader('/')('data/x.json')).rejects.toBeInstanceOf(AxiosError);
  });
});

describe('createDefaultLocalStockProvider', () => {
  it('fetches fixtures under the given base url', async () => {
    vi.mocked(axios.get).mockImplementation(async (url: string) => {
      if (url.endsWith('/data/detail-AAPL.json')) return { data: detailAapl, headers: json };
      if (url.endsWith('/data/historic-AAPL-MONTH.json')) return { data: historyMonth, headers: json };
      throw new AxiosError('nf', undefined, undefined, undefined, { status: 404 } as AxiosResponse);
    });
    const provider = createDefaultLocalStockProvider('/base/');

    expect(await provider.getDetails('AAPL')).toMatchObject({ displayName: 'Apple' });
    expect((await provider.getPriceSeries('AAPL', 'MONTH')).records).toHaveLength(20);
    await expect(provider.getHighLow('AAPL', 'MONTH')).rejects.toBeInstanceOf(SymbolNotFoundError);
    expect(vi.mocked(axios.get).mock.calls.map((c) => c[0])).toEqual([
      '/base/data/detail-AAPL.json',
      '/base/data/historic-AAPL-MONTH.json',
      '/base/data/highlow-AAPL-MONTH.json',
    ]);
  });
});
