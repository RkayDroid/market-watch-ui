import axios, { AxiosError, type AxiosResponse } from 'axios';
import { afterEach, describe, expect, it, vi } from 'vitest';
import detailAapl from '../../../json/detail-AAPL.json';
import {
  createDefaultLocalStockProvider,
  createHttpDetailsLoader,
  createLocalStockProvider,
  localDetailsPath,
  OFFLINE_SYMBOLS,
  type DetailsLoader,
} from './LocalStockProvider.ts';
import { SymbolNotFoundError } from './StockProvider.ts';

vi.mock('axios', async (importOriginal) => {
  const actual = await importOriginal<typeof import('axios')>();
  return { ...actual, default: { ...actual.default, get: vi.fn() } };
});

afterEach(() => vi.restoreAllMocks());

/** Response headers of a JSON fixture served by a static host. */
const json = { 'content-type': 'application/json; charset=utf-8' };

const DETAILS: Record<string, unknown> = { AAPL: detailAapl, TSLA: { symbol: 'TSLA', sector: 'Consumer Cyclical' } };

const loader: DetailsLoader = async (symbol) => DETAILS[symbol] ?? null;

describe('createLocalStockProvider', () => {
  it('serves details parsed from the JSON fixture', async () => {
    const provider = createLocalStockProvider(loader);
    expect(await provider.getDetails('AAPL')).toMatchObject({ symbol: 'AAPL', displayName: 'Apple' });
    expect(await provider.getDetails('TSLA')).toEqual({ symbol: 'TSLA', sector: 'Consumer Cyclical' });
  });

  it('has no price history', () => {
    expect(createLocalStockProvider(loader).getPrices).toBeUndefined();
  });

  it('rejects symbols without a fixture, suggesting the shipped offline symbols', async () => {
    const err = await createLocalStockProvider(loader).getDetails('NOPE').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SymbolNotFoundError);
    expect((err as SymbolNotFoundError).availableSymbols).toEqual(OFFLINE_SYMBOLS);
    expect((err as Error).message).toBe(
      'Symbol "NOPE" was not found in the offline data. Available symbols: AAPL, GOOG, META.',
    );
  });

  it('accepts a custom list of available symbols', async () => {
    const provider = createLocalStockProvider(loader, { availableSymbols: ['X', 'Y'] });
    const err = await provider.getDetails('NOPE').catch((e: unknown) => e);
    expect((err as SymbolNotFoundError).availableSymbols).toEqual(['X', 'Y']);
  });

  it('reports malformed fixture files with the reason', async () => {
    const provider = createLocalStockProvider(async () => ({ sector: 'no symbol here' }));
    await expect(provider.getDetails('AAPL')).rejects.toThrow(
      'The local details file for AAPL is malformed: "symbol" is missing.',
    );
  });

  it('propagates loader failures other than not-found', async () => {
    const provider = createLocalStockProvider(async () => {
      throw new Error('disk on fire');
    });
    await expect(provider.getDetails('AAPL')).rejects.toThrow('disk on fire');
  });
});

describe('localDetailsPath', () => {
  it('follows the detail-{SYMBOL}.json convention', () => {
    expect(localDetailsPath('AAPL')).toBe('data/detail-AAPL.json');
    expect(localDetailsPath('BRK.B')).toBe('data/detail-BRK.B.json');
    expect(localDetailsPath('A B')).toBe('data/detail-A%20B.json');
  });
});

describe('createHttpDetailsLoader', () => {
  it('fetches the fixture relative to the base url as JSON', async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: detailAapl, headers: json });
    const loader = createHttpDetailsLoader('/app');

    expect(await loader('AAPL')).toBe(detailAapl);
    expect(axios.get).toHaveBeenCalledWith('/app/data/detail-AAPL.json', {
      headers: { Accept: 'application/json' },
    });
  });

  it('does not double up the slash when the base already ends with one', async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: {}, headers: json });
    await createHttpDetailsLoader('/')('AAPL');
    expect(vi.mocked(axios.get).mock.calls[0][0]).toBe('/data/detail-AAPL.json');
  });

  it('maps a 404 to null', async () => {
    vi.mocked(axios.get).mockRejectedValue(
      new AxiosError('nf', undefined, undefined, undefined, { status: 404 } as AxiosResponse),
    );
    expect(await createHttpDetailsLoader('/')('NOPE')).toBeNull();
  });

  it('treats a non-JSON 200 (SPA fallback page) as "no file"', async () => {
    vi.mocked(axios.get).mockResolvedValue({
      data: '<!doctype html><html></html>',
      headers: { 'content-type': 'text/html' },
    });
    expect(await createHttpDetailsLoader('/')('NOPE')).toBeNull();
  });

  it('rethrows other HTTP failures', async () => {
    vi.mocked(axios.get).mockRejectedValue(
      new AxiosError('boom', undefined, undefined, undefined, { status: 500 } as AxiosResponse),
    );
    await expect(createHttpDetailsLoader('/')('AAPL')).rejects.toBeInstanceOf(AxiosError);
  });
});

describe('createDefaultLocalStockProvider', () => {
  it('fetches detail fixtures under the given base url', async () => {
    vi.mocked(axios.get).mockImplementation(async (url: string) => {
      if (url.endsWith('/data/detail-AAPL.json')) return { data: detailAapl, headers: json };
      throw new AxiosError('nf', undefined, undefined, undefined, { status: 404 } as AxiosResponse);
    });
    const provider = createDefaultLocalStockProvider('/base/');

    expect(await provider.getDetails('AAPL')).toMatchObject({ displayName: 'Apple' });
    await expect(provider.getDetails('V')).rejects.toBeInstanceOf(SymbolNotFoundError);
    expect(vi.mocked(axios.get).mock.calls.map((c) => c[0])).toEqual([
      '/base/data/detail-AAPL.json',
      '/base/data/detail-V.json',
    ]);
  });
});
