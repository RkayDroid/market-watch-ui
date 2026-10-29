import { describe, expect, it, vi } from 'vitest';
import type { StockProvider } from '../data/providers/StockProvider.ts';
import type { PriceSeries } from '../types/stock.ts';
import { createStockService, InvalidSymbolError } from './stockService.ts';

const series: PriceSeries = {
  symbol: 'NFLX',
  period: 'WEEK',
  interval: '1d',
  records: [
    { date: '2026-10-19', open: 99, high: 101, low: 98, close: 100 },
    { date: '2026-10-20', open: 100, high: 112, low: 99, close: 110 },
  ],
};

function fakeProvider() {
  const getDetails = vi.fn(async (symbol: string) => ({ symbol, displayName: `${symbol} Inc.` }));
  const getPriceSeries = vi.fn(async () => series);
  const provider: StockProvider = { getDetails, getPriceSeries };
  return { provider, getDetails, getPriceSeries };
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
      const provider: StockProvider = { ...fakeProvider().provider, getDetails: async () => ({ symbol: 'BRK.A' }) };
      const service = createStockService({ api: provider, local: provider });
      expect((await service.lookup('brk.a', 'api')).symbol).toBe('BRK.A');
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
    it('calls historic once for the symbol and period and summarises it, high/low included', async () => {
      const api = fakeProvider();
      const service = createStockService({ api: api.provider, local: fakeProvider().provider }, { formatLabel: (d) => d });

      const result = await service.performance('nflx', 'WEEK', 'api');

      expect(api.getPriceSeries).toHaveBeenCalledTimes(1);
      expect(api.getPriceSeries).toHaveBeenCalledWith('NFLX', 'WEEK', undefined);
      expect(api.getDetails).not.toHaveBeenCalled();
      expect(result).toMatchObject({
        symbol: 'NFLX',
        period: 'WEEK',
        latestPrice: 110,
        changePercent: 10,
        high: { price: 112, occurredAt: '2026-10-20' },
        low: { price: 98, occurredAt: '2026-10-19' },
      });
      expect(result.points).toHaveLength(2);
    });

    it('passes the reference date through, mapping a blank one to "none"', async () => {
      const api = fakeProvider();
      const service = createStockService({ api: api.provider, local: fakeProvider().provider });

      await service.performance('NFLX', 'WEEK', 'api', '2026-10-01');
      expect(api.getPriceSeries).toHaveBeenLastCalledWith('NFLX', 'WEEK', '2026-10-01');
      await service.performance('NFLX', 'WEEK', 'api', '');
      expect(api.getPriceSeries).toHaveBeenLastCalledWith('NFLX', 'WEEK', undefined);
      await service.performance('NFLX', 'WEEK', 'api');
      expect(api.getPriceSeries).toHaveBeenLastCalledWith('NFLX', 'WEEK', undefined);
    });

    it('surfaces the served reference date and window on the view model', async () => {
      const api = fakeProvider();
      api.getPriceSeries.mockResolvedValue({ ...series, referenceDate: '2026-10-20', window: { start: '2026-10-19', end: '2026-10-20' } });
      const service = createStockService({ api: api.provider, local: fakeProvider().provider });
      const result = await service.performance('NFLX', 'WEEK', 'api', '2026-10-20');
      expect(result.referenceDate).toBe('2026-10-20');
      expect(result.window).toEqual({ start: '2026-10-19', end: '2026-10-20' });
    });

    it('rejects blank symbols and propagates provider failures', async () => {
      const api = fakeProvider();
      api.getPriceSeries.mockRejectedValue(new Error('historic down'));
      const service = createStockService({ api: api.provider, local: fakeProvider().provider });

      await expect(service.performance(' ', 'DAY', 'api')).rejects.toBeInstanceOf(InvalidSymbolError);
      await expect(service.performance('NFLX', 'DAY', 'api')).rejects.toThrow('historic down');
    });
  });
});
