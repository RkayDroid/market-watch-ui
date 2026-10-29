import { describe, expect, it } from 'vitest';
import { computeHighLow } from '../services/stockAnalytics.ts';
import { PERFORMANCE_PERIODS } from '../types/performance.ts';
import { parsePriceSeries } from './priceSeries.ts';
import { OFFLINE_REFERENCE_DATES, OFFLINE_SYMBOLS } from './providers/LocalStockProvider.ts';
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
  const VARIANTS = Object.values(OFFLINE_REFERENCE_DATES);

  it('cover every offline symbol with details plus historic data for all six periods and reference dates, and nothing else', () => {
    const expected = OFFLINE_SYMBOLS.flatMap((s) => [
      `detail-${s}.json`,
      ...PERIODS.flatMap((p) => [`historic-${s}-${p}.json`, ...VARIANTS.map((v) => `historic-${s}-${p}-${v}.json`)]),
    ]);
    expect(Object.keys(byName).sort()).toEqual(expected.sort());
    expect(Object.keys(byName)).toHaveLength(OFFLINE_SYMBOLS.length * (1 + PERIODS.length * (1 + VARIANTS.length)));
  });

  it.each(OFFLINE_SYMBOLS)('detail-%s.json parses and matches its file name', (symbol) => {
    const details = parseStockDetails(byName[`detail-${symbol}.json`]);
    expect(details.symbol).toBe(symbol);
    expect(details.fulldayPrice).toEqual(expect.any(Number));
  });

  it.each(OFFLINE_SYMBOLS.flatMap((s) => PERIODS.map((p) => [s, p] as const)))(
    'historic-%s-%s.json parses for the symbol and period in its name and yields a high/low',
    (symbol, period) => {
      const series = parsePriceSeries(byName[`historic-${symbol}-${period}.json`], { symbol, period });
      expect(series.records.length).toBeGreaterThan(1);
      expect(series.interval).toMatch(/^\d+(h|d|wk|mo)$/);

      const { high, low } = computeHighLow(series.records);
      expect(low.price).toBeLessThanOrEqual(high.price);
      expect(series.records.map((r) => r.date)).toEqual(expect.arrayContaining([high.occurredAt, low.occurredAt]));
    },
  );

  it.each(
    OFFLINE_SYMBOLS.flatMap((s) => PERIODS.flatMap((p) => Object.entries(OFFLINE_REFERENCE_DATES).map(([d, v]) => [s, p, v, d] as const))),
  )('historic-%s-%s-%s.json holds the window for reference date %s', (symbol, period, variant, referenceDate) => {
    const series = parsePriceSeries(byName[`historic-${symbol}-${period}-${variant}.json`], { symbol, period, referenceDate });
    expect(series.referenceDate).toBe(referenceDate);
    expect(series.window?.end).toBe(referenceDate);
    expect(series.records.length).toBeGreaterThan(1);
    expect(series.records[series.records.length - 1].date.slice(0, 10)).toBe(referenceDate);
  });
});
