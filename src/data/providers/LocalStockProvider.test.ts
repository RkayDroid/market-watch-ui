import axios, { AxiosError, type AxiosResponse } from 'axios';
import { afterEach, describe, expect, it, vi } from 'vitest';
import detailAapl from '../../../json/detail-AAPL.json';
import { createCsvPriceProvider } from './CsvPriceProvider.ts';
import {
  createDefaultLocalStockProvider,
  createHttpDetailsLoader,
  createLocalStockProvider,
  localDetailsPath,
  type DetailsLoader,
} from './LocalStockProvider.ts';
import { SymbolNotFoundError } from './StockProvider.ts';

vi.mock('axios', async (importOriginal) => {
  const actual = await importOriginal<typeof import('axios')>();
  return { ...actual, default: { ...actual.default, get: vi.fn() } };
});

afterEach(() => vi.restoreAllMocks());

const CSV = `symbol,date,rate
AAPL,2026-10-21T15:00:00Z,220.10
AAPL,2026-10-21T16:00:00Z,221.00
V,2026-10-21T15:00:00Z,275.20
`;

/** Response headers of a JSON fixture served by a static host. */
const json = { 'content-type': 'application/json; charset=utf-8' };

const DETAILS: Record<string, unknown> = { AAPL: detailAapl, TSLA: { symbol: 'TSLA', sector: 'Consumer Cyclical' } };

function build(loader: DetailsLoader = async (s) => DETAILS[s] ?? null) {
  return createLocalStockProvider(createCsvPriceProvider(async () => CSV), loader);
}

describe('createLocalStockProvider', () => {
  it('serves details from the JSON fixture and history from the CSV', async () => {
    const provider = build();
    expect(await provider.getDetails('AAPL')).toMatchObject({ symbol: 'AAPL', displayName: 'Apple' });
    expect(await provider.getPrices!('AAPL')).toEqual([
      { date: '2026-10-21T15:00:00.000Z', rate: 220.1 },
      { date: '2026-10-21T16:00:00.000Z', rate: 221 },
    ]);
  });

  it('falls back to bare details for symbols only in the CSV', async () => {
    const provider = build();
    expect(await provider.getDetails('V')).toEqual({ symbol: 'V' });
    expect(await provider.getPrices!('V')).toHaveLength(1);
  });

  it('returns an empty history for symbols only in the JSON fixtures', async () => {
    const provider = build();
    expect(await provider.getDetails('TSLA')).toEqual({ symbol: 'TSLA', sector: 'Consumer Cyclical' });
    expect(await provider.getPrices!('TSLA')).toEqual([]);
  });

  it('rejects symbols in neither source, listing what the CSV has', async () => {
    const err = await build().getDetails('NOPE').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SymbolNotFoundError);
    expect((err as SymbolNotFoundError).availableSymbols).toEqual(['AAPL', 'V']);
    expect((err as Error).message).toBe(
      'Symbol "NOPE" was not found in the local data files. Available symbols: AAPL, V.',
    );
  });

  it('reports malformed fixture files with the reason', async () => {
    const provider = build(async () => ({ sector: 'no symbol here' }));
    await expect(provider.getDetails('AAPL')).rejects.toThrow(
      'The local details file for AAPL is malformed: "symbol" is missing.',
    );
  });

  it('propagates loader failures other than not-found', async () => {
    const provider = build(async () => {
      throw new Error('disk on fire');
    });
    await expect(provider.getDetails('AAPL')).rejects.toThrow('disk on fire');
  });

  it('propagates CSV failures from getPrices', async () => {
    const provider = createLocalStockProvider(
      createCsvPriceProvider(async () => {
        throw new Error('csv unavailable');
      }),
      async () => null,
    );
    await expect(provider.getPrices!('AAPL')).rejects.toThrow('csv unavailable');
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

  it('maps a 404 to null so the provider can fall back to the CSV', async () => {
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
  it('wires the CSV and detail fixtures under the same base url', async () => {
    vi.mocked(axios.get).mockImplementation(async (url: string) => {
      if (url.endsWith('/local-data.csv')) return { data: CSV };
      if (url.endsWith('/data/detail-AAPL.json')) return { data: detailAapl, headers: json };
      throw new AxiosError('nf', undefined, undefined, undefined, { status: 404 } as AxiosResponse);
    });
    const provider = createDefaultLocalStockProvider('/base/');

    expect(await provider.getDetails('AAPL')).toMatchObject({ displayName: 'Apple' });
    expect(await provider.getPrices!('AAPL')).toHaveLength(2);
    expect(vi.mocked(axios.get).mock.calls.map((c) => c[0])).toEqual([
      '/base/data/detail-AAPL.json',
      '/base/local-data.csv',
    ]);
  });
});
