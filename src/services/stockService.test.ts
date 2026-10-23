import { describe, expect, it, vi } from 'vitest';
import type { PriceProvider } from '../data/providers/PriceProvider.ts';
import { createStockService, InvalidSymbolError } from './stockService.ts';

const series = [
  { date: '2026-10-21T15:00:00Z', rate: 100 },
  { date: '2026-10-21T16:00:00Z', rate: 110 },
];

function fakeProvider(): PriceProvider & { getPrices: ReturnType<typeof vi.fn> } {
  return { getPrices: vi.fn(async () => series) };
}

describe('createStockService', () => {
  it('routes to the provider for the requested source with a normalised symbol', async () => {
    const api = fakeProvider();
    const file = fakeProvider();
    const service = createStockService({ api, file }, { formatLabel: (d) => d });

    const result = await service.lookup('  nflx ', 'file');

    expect(file.getPrices).toHaveBeenCalledWith('NFLX');
    expect(api.getPrices).not.toHaveBeenCalled();
    expect(result).toMatchObject({ symbol: 'NFLX', currentPrice: 110, changePercent: 10 });
    expect(result.history).toHaveLength(2);
  });

  it('rejects blank symbols before touching a provider', async () => {
    const api = fakeProvider();
    const service = createStockService({ api, file: fakeProvider() });
    await expect(service.lookup('   ', 'api')).rejects.toBeInstanceOf(InvalidSymbolError);
    expect(api.getPrices).not.toHaveBeenCalled();
  });

  it('propagates provider failures', async () => {
    const failing: PriceProvider = { getPrices: async () => { throw new Error('boom'); } };
    const service = createStockService({ api: failing, file: failing });
    await expect(service.lookup('V', 'api')).rejects.toThrow('boom');
  });
});
