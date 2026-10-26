import { describe, expect, it, vi } from 'vitest';
import { createCsvPriceProvider } from './CsvPriceProvider.ts';
import { SymbolNotFoundError } from './StockProvider.ts';

const CSV = [
  'symbol,date,rate',
  'V,2026-10-21T16:00:00Z,2',
  'V,2026-10-21T15:00:00Z,1',
  'AAPL,2026-10-21T15:00:00Z,10',
].join('\n');

describe('createCsvPriceProvider', () => {
  it('returns the chronologically sorted series for a known symbol', async () => {
    const provider = createCsvPriceProvider(async () => CSV);
    await expect(provider.getPrices('V')).resolves.toEqual([
      { date: '2026-10-21T15:00:00.000Z', rate: 1 },
      { date: '2026-10-21T16:00:00.000Z', rate: 2 },
    ]);
  });

  it('lists symbols alphabetically', async () => {
    const provider = createCsvPriceProvider(async () => CSV);
    await expect(provider.listSymbols()).resolves.toEqual(['AAPL', 'V']);
  });

  it('throws SymbolNotFoundError listing available symbols', async () => {
    const provider = createCsvPriceProvider(async () => CSV);
    const err = await provider.getPrices('TSLA').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SymbolNotFoundError);
    expect((err as SymbolNotFoundError).availableSymbols).toEqual(['AAPL', 'V']);
    expect((err as Error).message).toMatch(/"TSLA" was not found in the local data file\. Available symbols: AAPL, V/);
  });

  it('loads and parses the file only once across calls', async () => {
    const loader = vi.fn(async () => CSV);
    const provider = createCsvPriceProvider(loader);
    await Promise.all([provider.getPrices('V'), provider.getPrices('AAPL'), provider.listSymbols()]);
    await provider.getPrices('V');
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('does not cache a failed load, allowing retry', async () => {
    const loader = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(CSV);
    const provider = createCsvPriceProvider(loader);

    await expect(provider.getPrices('V')).rejects.toThrow('network down');
    await expect(provider.getPrices('V')).resolves.toHaveLength(2);
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('surfaces CSV parse errors', async () => {
    const provider = createCsvPriceProvider(async () => 'symbol,date,rate\nV,bad-date,1');
    await expect(provider.getPrices('V')).rejects.toThrow(/line 2: invalid date/);
  });
});
