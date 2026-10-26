import { describe, expect, it, vi } from 'vitest';
import type { StockProvider } from '../data/providers/StockProvider.ts';
import { createStockService, InvalidSymbolError } from './stockService.ts';

const series = [
  { date: '2026-10-21T15:00:00Z', rate: 100 },
  { date: '2026-10-21T16:00:00Z', rate: 110 },
];

function fakeProvider(withPrices = true) {
  const getDetails = vi.fn(async (symbol: string) => ({ symbol, displayName: `${symbol} Inc.` }));
  const getPrices = vi.fn(async () => series);
  const provider: StockProvider = withPrices ? { getDetails, getPrices } : { getDetails };
  return { provider, getDetails, getPrices };
}

describe('createStockService', () => {
  it('routes to the provider for the requested source with a normalised symbol', async () => {
    const api = fakeProvider();
    const local = fakeProvider();
    const service = createStockService({ api: api.provider, local: local.provider }, { formatLabel: (d) => d });

    const result = await service.lookup('  nflx ', 'local');

    expect(local.getDetails).toHaveBeenCalledWith('NFLX');
    expect(local.getPrices).toHaveBeenCalledWith('NFLX');
    expect(api.getDetails).not.toHaveBeenCalled();
    expect(result.symbol).toBe('NFLX');
    expect(result.details).toEqual({ symbol: 'NFLX', displayName: 'NFLX Inc.' });
    expect(result.history).toMatchObject({ currentPrice: 110, changePercent: 10 });
    expect(result.history?.hourly).toHaveLength(2);
  });

  it('returns a null history for providers without price data', async () => {
    const api = fakeProvider(false);
    const service = createStockService({ api: api.provider, local: fakeProvider().provider });

    const result = await service.lookup('aapl', 'api');

    expect(api.getDetails).toHaveBeenCalledWith('AAPL');
    expect(result).toEqual({ symbol: 'AAPL', details: { symbol: 'AAPL', displayName: 'AAPL Inc.' }, history: null });
  });

  it('uses the symbol reported by the provider, not the one typed', async () => {
    const provider: StockProvider = { getDetails: async () => ({ symbol: 'BRK.B' }) };
    const service = createStockService({ api: provider, local: provider });
    expect((await service.lookup('brk.b', 'api')).symbol).toBe('BRK.B');
  });

  it('rejects blank symbols before touching a provider', async () => {
    const api = fakeProvider();
    const service = createStockService({ api: api.provider, local: fakeProvider().provider });
    await expect(service.lookup('   ', 'api')).rejects.toBeInstanceOf(InvalidSymbolError);
    expect(api.getDetails).not.toHaveBeenCalled();
  });

  it('propagates provider failures', async () => {
    const failing: StockProvider = {
      getDetails: async () => {
        throw new Error('boom');
      },
    };
    const service = createStockService({ api: failing, local: failing });
    await expect(service.lookup('V', 'api')).rejects.toThrow('boom');
  });
});
