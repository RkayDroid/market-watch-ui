import { describe, expect, it } from 'vitest';
import type { HighLow, PriceSeries } from '../types/stock.ts';
import {
  buildTrendPoints,
  computeChangePercent,
  computeTrend,
  formatHourLabel,
  formatPointLabel,
  isBareDate,
  summarizePerformance,
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

describe('isBareDate', () => {
  it('distinguishes bare dates from timestamps', () => {
    expect(isBareDate('2026-10-19')).toBe(true);
    expect(isBareDate('2026-10-22T09:30:00-04:00')).toBe(false);
    expect(isBareDate('2026-10-19T00:00:00Z')).toBe(false);
  });
});

describe('formatHourLabel', () => {
  it('formats with explicit locale and time zone', () => {
    expect(formatHourLabel('2026-10-21T15:00:00Z', { locale: 'en-US', timeZone: 'UTC' })).toBe(
      'Oct 21, 03:00 PM',
    );
  });

  it('honours the API offset when rendered in that zone', () => {
    expect(formatHourLabel('2026-10-22T09:30:00-04:00', { locale: 'en-US', timeZone: 'America/New_York' })).toBe(
      'Oct 22, 09:30 AM',
    );
  });
});

describe('formatPointLabel', () => {
  it('formats full timestamps like formatHourLabel', () => {
    expect(formatPointLabel('2026-10-21T15:00:00Z', { locale: 'en-US', timeZone: 'UTC' })).toBe('Oct 21, 03:00 PM');
  });

  it('formats bare dates as calendar dates, unaffected by the display time zone', () => {
    for (const timeZone of ['UTC', 'America/Los_Angeles', 'Pacific/Kiritimati']) {
      expect(formatPointLabel('2026-10-19', { locale: 'en-US', timeZone })).toBe('Oct 19, 2026');
    }
  });
});

describe('buildTrendPoints', () => {
  const records = [
    { date: '2026-10-21T15:00:00Z', rate: 10 },
    { date: '2026-10-21T16:00:00Z', rate: 12 },
    { date: '2026-10-21T17:00:00Z', rate: 12 },
    { date: '2026-10-21T18:00:00Z', rate: 9 },
  ];

  it('labels each point and assigns trends relative to the previous sample', () => {
    expect(buildTrendPoints(records, (d) => d)).toEqual([
      { label: '2026-10-21T15:00:00Z', price: 10, trend: 'neutral' },
      { label: '2026-10-21T16:00:00Z', price: 12, trend: 'up' },
      { label: '2026-10-21T17:00:00Z', price: 12, trend: 'neutral' },
      { label: '2026-10-21T18:00:00Z', price: 9, trend: 'down' },
    ]);
  });

  it('uses the bare-date-aware formatter by default', () => {
    const [point] = buildTrendPoints([{ date: '2026-10-19', rate: 1 }]);
    expect(point.label).toMatch(/Oct 19, 2026/);
  });
});

describe('summarizePerformance', () => {
  const series: PriceSeries = {
    symbol: 'V',
    period: 'WEEK',
    interval: '1d',
    records: [
      { date: '2026-10-19', rate: 275.2 },
      { date: '2026-10-20', rate: 274.8 },
      { date: '2026-10-21', rate: 282.5 },
    ],
  };
  const highLow: HighLow = {
    symbol: 'V',
    period: 'WEEK',
    high: { price: 283.1, occurredAt: '2026-10-21' },
    low: { price: 270.4, occurredAt: '2026-10-20' },
  };

  it('combines the series and high/low into the view model', () => {
    const perf = summarizePerformance(series, highLow, (d) => d);
    expect(perf).toMatchObject({
      symbol: 'V',
      period: 'WEEK',
      interval: '1d',
      latestPrice: 282.5,
      changePercent: 2.65,
      high: { price: 283.1, occurredAt: '2026-10-21' },
      low: { price: 270.4, occurredAt: '2026-10-20' },
    });
    expect(perf.points.map((p) => p.trend)).toEqual(['neutral', 'down', 'up']);
    expect(perf.points[0].label).toBe('2026-10-19');
  });

  it('rejects an empty series', () => {
    expect(() => summarizePerformance({ ...series, records: [] }, highLow)).toThrow(/No price history available for V/);
  });
});
