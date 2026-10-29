import axios, { AxiosError, type AxiosResponse } from 'axios';
import { afterEach, describe, expect, it, vi } from 'vitest';
import detailAapl from '../../../public/data/detail-AAPL.json';
import historyMonth from '../../../public/data/historic-AAPL-MONTH.json';
import historyMonthRef1 from '../../../public/data/historic-AAPL-MONTH-1.json';
import historyMonthRef2 from '../../../public/data/historic-AAPL-MONTH-2.json';
import {
  createDefaultLocalStockProvider,
  createHttpJsonLoader,
  createLocalStockProvider,
  localDetailsPath,
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
  'data/detail-MSFT.json': { symbol: 'MSFT', sector: 'Technology' },
  'data/historic-AAPL-MONTH.json': historyMonth,
  'data/historic-AAPL-MONTH-1.json': historyMonthRef1,
  'data/historic-AAPL-MONTH-2.json': historyMonthRef2,
};

const loader: JsonLoader = async (path) => FILES[path] ?? null;

describe('fixture paths', () => {
  it('mirror the live endpoints', () => {
    expect(localDetailsPath('AAPL')).toBe('data/detail-AAPL.json');
    expect(localHistoricPath('AAPL', 'HALF_YEAR')).toBe('data/historic-AAPL-HALF_YEAR.json');
    expect(localHistoricPath('BRK.A', 'DAY')).toBe('data/historic-BRK.A-DAY.json');
    expect(localDetailsPath('A B')).toBe('data/detail-A%20B.json');
  });

  it('map the two captured reference dates to their files and every other date to the 2026-02-02 capture', () => {
    expect(localHistoricPath('AAPL', 'WEEK', '2025-10-10')).toBe('data/historic-AAPL-WEEK-1.json');
    expect(localHistoricPath('AAPL', 'WEEK', '2026-02-02')).toBe('data/historic-AAPL-WEEK-2.json');
    expect(localHistoricPath('AAPL', 'WEEK', '2026-05-05')).toBe('data/historic-AAPL-WEEK-2.json');
    expect(localHistoricPath('AAPL', 'WEEK', '1999-01-01')).toBe('data/historic-AAPL-WEEK-2.json');
    expect(localHistoricPath('AAPL', 'WEEK', '')).toBe('data/historic-AAPL-WEEK.json');
    expect(localHistoricPath('AAPL', 'WEEK', undefined)).toBe('data/historic-AAPL-WEEK.json');
  });
});

describe('createLocalStockProvider', () => {
  it('serves details parsed from the JSON fixture', async () => {
    const provider = createLocalStockProvider(loader);
    expect(await provider.getDetails('AAPL')).toMatchObject({ symbol: 'AAPL', displayName: 'Apple' });
    expect(await provider.getDetails('MSFT')).toEqual({ symbol: 'MSFT', sector: 'Technology' });
  });

  it('serves the price series for a period from its fixture', async () => {
    const provider = createLocalStockProvider(loader);
    const series = await provider.getPriceSeries('AAPL', 'MONTH');
    expect(series).toMatchObject({ symbol: 'AAPL', period: 'MONTH', interval: '1d' });
    expect(series.records).toHaveLength(22);
    expect(series.records[0]).toEqual({ date: '2026-09-29', open: 336.97, high: 337.09, low: 328.7, close: 329.4 });
  });

  it('serves the capture for a reference date, reporting the date the data is really for', async () => {
    const provider = createLocalStockProvider(loader);
    const exact = await provider.getPriceSeries('AAPL', 'MONTH', '2025-10-10');
    expect(exact).toMatchObject({ symbol: 'AAPL', period: 'MONTH', referenceDate: '2025-10-10' });
    expect(exact.window).toEqual({ start: '2025-09-11', end: '2025-10-10' });
    expect(exact.records).toHaveLength(22);

    const other = await provider.getPriceSeries('AAPL', 'MONTH', '2026-05-05');
    expect(other.referenceDate).toBe('2026-02-02'); // the stand-in, not the requested date
    expect(other.records).toHaveLength(20);

    expect((await provider.getPriceSeries('AAPL', 'MONTH')).referenceDate).toBe('2026-10-28');
  });

  it('rejects symbols without a fixture, suggesting the shipped offline symbols', async () => {
    const err = await createLocalStockProvider(loader).getDetails('NOPE').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SymbolNotFoundError);
    expect((err as SymbolNotFoundError).availableSymbols).toEqual(OFFLINE_SYMBOLS);
    expect((err as Error).message).toBe(
      'Symbol "NOPE" was not found in the offline data. Available symbols: AAPL, BRK.A, GOOG, META, NFLX, RBLX, TSLA.',
    );
  });

  it('rejects a period without a fixture the same way', async () => {
    const provider = createLocalStockProvider(loader);
    await expect(provider.getPriceSeries('AAPL', 'YEAR')).rejects.toBeInstanceOf(SymbolNotFoundError);
    await expect(provider.getPriceSeries('MSFT', 'MONTH')).rejects.toBeInstanceOf(SymbolNotFoundError);
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
    await expect(provider.getPriceSeries('AAPL', 'DAY')).rejects.toThrow(
      'The offline file data/historic-AAPL-DAY.json is malformed: "data" is not an array.',
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
    expect((await provider.getPriceSeries('AAPL', 'MONTH')).records).toHaveLength(22);
    await expect(provider.getPriceSeries('AAPL', 'WEEK')).rejects.toBeInstanceOf(SymbolNotFoundError);
    expect(vi.mocked(axios.get).mock.calls.map((c) => c[0])).toEqual([
      '/base/data/detail-AAPL.json',
      '/base/data/historic-AAPL-MONTH.json',
      '/base/data/historic-AAPL-WEEK.json',
    ]);
  });
});
