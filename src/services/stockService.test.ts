import { describe, expect, it, vi } from 'vitest';
import type { StockProvider } from '../data/providers/StockProvider.ts';
import type { HighLow, PriceSeries } from '../types/stock.ts';
import { createStockService, InvalidSymbolError } from './stockService.ts';

const series: PriceSeries = {
  symbol: 'NFLX',
  period: 'WEEK',
  interval: '1d',
  records: [
    { date: '2026-10-19', rate: 100 },
    { date: '2026-10-20', rate: 110 },
  ],
};
const highLow: HighLow = {
  symbol: 'NFLX',
  period: 'WEEK',
  high: { price: 112, occurredAt: '2026-10-20' },
  low: { price: 98, occurredAt: '2026-10-19' },
};

function fakeProvider() {
  const getDetails = vi.fn(async (symbol: string) => ({ symbol, displayName: `${symbol} Inc.` }));
  const getPriceSeries = vi.fn(async () => series);
  const getHighLow = vi.fn(async () => highLow);
  const provider: StockProvider = { getDetails, getPriceSeries, getHighLow };
  return { provider, getDetails, getPriceSeries, getHighLow };
}

describe('createStockService', () => {
  describe('lookup', () => {
    it('routes to the provider for the requested source with a normalised symbol', async () => {
      const api = fakeProvider();
      const local = fakeProvider();
      const service = createStockService({ api: api.provider, local: local.provider });

      const result = await service.lookup('  nflx ', 'local');

      expect(local.getDetails).toHaveBeenCalledWith('NFLX');
      expect(api.getDetails).not.toHaveBeenCalled();
      expect(local.getPriceSeries).not.toHaveBeenCalled();
      expect(result).toEqual({ symbol: 'NFLX', details: { symbol: 'NFLX', displayName: 'NFLX Inc.' } });
    });

    it('uses the symbol reported by the provider, not the one typed', async () => {
      const provider: StockProvider = { ...fakeProvider().provider, getDetails: async () => ({ symbol: 'BRK.B' }) };
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
        ...fakeProvider().provider,
        getDetails: async () => {
          throw new Error('boom');
        },
      };
      const service = createStockService({ api: failing, local: failing });
      await expect(service.lookup('V', 'api')).rejects.toThrow('boom');
    });
  });

  describe('performance', () => {
    it('calls historic and high/low for the symbol and period and summarises them', async () => {
      const api = fakeProvider();
      const service = createStockService({ api: api.provider, local: fakeProvider().provider }, { formatLabel: (d) => d });

      const result = await service.performance('nflx', 'WEEK', 'api');

      expect(api.getPriceSeries).toHaveBeenCalledWith('NFLX', 'WEEK');
      expect(api.getHighLow).toHaveBeenCalledWith('NFLX', 'WEEK');
      expect(api.getDetails).not.toHaveBeenCalled();
      expect(result).toMatchObject({
        symbol: 'NFLX',
        period: 'WEEK',
        latestPrice: 110,
        changePercent: 10,
        high: { price: 112 },
        low: { price: 98 },
      });
      expect(result.points).toHaveLength(2);
    });

    it('rejects blank symbols and propagates failures from either call', async () => {
      const api = fakeProvider();
      api.getHighLow.mockRejectedValue(new Error('highlow down'));
      const service = createStockService({ api: api.provider, local: fakeProvider().provider });

      await expect(service.performance(' ', 'DAY', 'api')).rejects.toBeInstanceOf(InvalidSymbolError);
      await expect(service.performance('NFLX', 'DAY', 'api')).rejects.toThrow('highlow down');
    });
  });
});
