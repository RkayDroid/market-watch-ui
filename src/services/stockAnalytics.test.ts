import { describe, expect, it } from 'vitest';
import {
  buildHourlyHistory,
  computeChangePercent,
  computeTrend,
  formatHourLabel,
  summarizeStock,
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

describe('summarizeStock', () => {
  it('computes the summary view model', () => {
    const stock = summarizeStock(
      'V',
      [
        { date: '2026-10-21T15:00:00Z', rate: 275.2 },
        { date: '2026-10-21T16:00:00Z', rate: 274.8 },
        { date: '2026-10-21T17:00:00Z', rate: 282.5 },
      ],
      (d) => d,
    );
    expect(stock).toMatchObject({
      symbol: 'V',
      currentPrice: 282.5,
      highPrice: 282.5,
      lowPrice: 274.8,
      changePercent: 2.65,
    });
    expect(stock.history.map((h) => h.trend)).toEqual(['neutral', 'down', 'up']);
  });

  it('throws for an empty series', () => {
    expect(() => summarizeStock('V', [])).toThrow(/No price data available for V/);
  });
});
