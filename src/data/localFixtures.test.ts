import { describe, expect, it } from 'vitest';
import { PERFORMANCE_PERIODS } from '../types/performance.ts';
import { parseHighLow } from './highLow.ts';
import { parsePriceSeries } from './priceSeries.ts';
import { OFFLINE_SYMBOLS } from './providers/LocalStockProvider.ts';
import { parseStockDetails } from './stockDetails.ts';

/**
 * Guards the offline fixtures under `public/data/`: every file the offline provider
 * can ask for exists, parses under the live contract, and matches its file name.
 * (The provider resolves files by symbol and period, so a mismatch would be silent.)
 */
const served = import.meta.glob<unknown>('../../public/data/*.json', { eager: true, import: 'default' });
const byName = Object.fromEntries(Object.entries(served).map(([p, v]) => [p.split('/').pop()!, v]));

const PERIODS = PERFORMANCE_PERIODS.map((p) => p.value);

describe('public/data fixtures', () => {
  it('cover every offline symbol with details plus historic and high/low for all six periods', () => {
    const expected = OFFLINE_SYMBOLS.flatMap((s) => [
      `detail-${s}.json`,
      ...PERIODS.flatMap((p) => [`historic-${s}-${p}.json`, `highlow-${s}-${p}.json`]),
    ]);
    expect(Object.keys(byName).sort()).toEqual(expected.sort());
    expect(Object.keys(byName)).toHaveLength(OFFLINE_SYMBOLS.length * (1 + 2 * PERIODS.length));
  });

  it.each(OFFLINE_SYMBOLS)('detail-%s.json parses and matches its file name', (symbol) => {
    const details = parseStockDetails(byName[`detail-${symbol}.json`]);
    expect(details.symbol).toBe(symbol);
    expect(details.fulldayPrice).toEqual(expect.any(Number));
  });

  it.each(OFFLINE_SYMBOLS.flatMap((s) => PERIODS.map((p) => [s, p] as const)))(
    'historic-%s-%s.json and highlow-%s-%s.json parse for the symbol and period in their names',
    (symbol, period) => {
      const series = parsePriceSeries(byName[`historic-${symbol}-${period}.json`], { symbol, period });
      expect(series.records.length).toBeGreaterThan(1);
      expect(series.interval).toMatch(/^\d+(h|d|wk|mo)$/);

      const highLow = parseHighLow(byName[`highlow-${symbol}-${period}.json`], { symbol, period });
      expect(highLow.low.price).toBeLessThanOrEqual(highLow.high.price);
    },
  );
});
