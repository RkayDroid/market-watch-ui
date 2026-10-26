import { describe, expect, it } from 'vitest';
import {
  buildHourlyHistory,
  buildStockData,
  computeChangePercent,
  computeTrend,
  formatHourLabel,
  summarizePriceHistory,
} from './stockAnalytics.ts';

describe('computeTrend', () => {
  it.each([
    [5, undefined, 'neutral'],
    [5, 5, 'neutral'],
    [6, 5, 'up'],
    [4, 5, 'down'],
  ])('current=%s previous=%s → %s', (current, previous, expected) => {
    expect(computeTrend(current, previous)).toBe(expected);
  });
});

describe('computeChangePercent', () => {
  it('rounds to two decimals', () => {
    expect(computeChangePercent(275.2, 282.5)).toBe(2.65);
    expect(computeChangePercent(100, 90)).toBe(-10);
  });

  it('guards against division by zero', () => {
    expect(computeChangePercent(0, 10)).toBe(0);
  });
});

describe('formatHourLabel', () => {
  it('formats with explicit locale and time zone', () => {
    expect(formatHourLabel('2026-10-21T15:00:00Z', { locale: 'en-US', timeZone: 'UTC' })).toBe(
      'Oct 21, 03:00 PM',
    );
  });
});

describe('buildHourlyHistory', () => {
  const records = [
    { date: '2026-10-21T15:00:00Z', rate: 10 },
    { date: '2026-10-21T16:00:00Z', rate: 12 },
    { date: '2026-10-21T17:00:00Z', rate: 12 },
    { date: '2026-10-21T18:00:00Z', rate: 9 },
  ];

  it('labels each point and assigns trends relative to the previous hour', () => {
    expect(buildHourlyHistory(records, (d) => d)).toEqual([
      { hour: '2026-10-21T15:00:00Z', price: 10, trend: 'neutral' },
      { hour: '2026-10-21T16:00:00Z', price: 12, trend: 'up' },
      { hour: '2026-10-21T17:00:00Z', price: 12, trend: 'neutral' },
      { hour: '2026-10-21T18:00:00Z', price: 9, trend: 'down' },
    ]);
  });
});

describe('summarizePriceHistory', () => {
  const series = [
    { date: '2026-10-21T15:00:00Z', rate: 275.2 },
    { date: '2026-10-21T16:00:00Z', rate: 274.8 },
    { date: '2026-10-21T17:00:00Z', rate: 282.5 },
  ];

  it('computes the derived figures and hourly rows', () => {
    const history = summarizePriceHistory(series, (d) => d);
    expect(history).toMatchObject({
      currentPrice: 282.5,
      highPrice: 282.5,
      lowPrice: 274.8,
      changePercent: 2.65,
    });
    expect(history?.hourly.map((h) => h.trend)).toEqual(['neutral', 'down', 'up']);
  });

  it('is null for an empty series', () => {
    expect(summarizePriceHistory([])).toBeNull();
  });
});

describe('buildStockData', () => {
  const details = { symbol: 'V', displayName: 'Visa', currency: 'USD' };

  it('combines details with a summarised history', () => {
    const stock = buildStockData(details, [{ date: '2026-10-21T15:00:00Z', rate: 275.2 }], (d) => d);
    expect(stock.symbol).toBe('V');
    expect(stock.details).toBe(details);
    expect(stock.history).toMatchObject({ currentPrice: 275.2, changePercent: 0 });
    expect(stock.history?.hourly).toEqual([{ hour: '2026-10-21T15:00:00Z', price: 275.2, trend: 'neutral' }]);
  });

  it('yields a null history when the source has no prices', () => {
    expect(buildStockData(details, [])).toEqual({ symbol: 'V', details, history: null });
  });
});
