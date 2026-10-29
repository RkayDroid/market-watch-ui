import { describe, expect, it } from 'vitest';
import type { PriceRecord, PriceSeries } from '../types/stock.ts';
import {
  buildTrendPoints,
  computeChangePercent,
  computeHighLow,
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

/** A candle whose open/high/low are uninteresting; only `close` drives the trend points. */
const candle = (date: string, close: number, extra: Partial<PriceRecord> = {}): PriceRecord => ({
  date,
  open: close,
  high: close,
  low: close,
  close,
  ...extra,
});

describe('buildTrendPoints', () => {
  const records = [
    candle('2026-10-21T15:00:00Z', 10, { high: 99, low: 1 }),
    candle('2026-10-21T16:00:00Z', 12),
    candle('2026-10-21T17:00:00Z', 12),
    candle('2026-10-21T18:00:00Z', 9),
  ];

  it('labels each point, plots the close as price, carries open/high/low and trends on the close', () => {
    expect(buildTrendPoints(records, (d) => d)).toEqual([
      { label: '2026-10-21T15:00:00Z', open: 10, high: 99, low: 1, price: 10, trend: 'neutral' },
      { label: '2026-10-21T16:00:00Z', open: 12, high: 12, low: 12, price: 12, trend: 'up' },
      { label: '2026-10-21T17:00:00Z', open: 12, high: 12, low: 12, price: 12, trend: 'neutral' },
      { label: '2026-10-21T18:00:00Z', open: 9, high: 9, low: 9, price: 9, trend: 'down' },
    ]);
  });

  it('derives the trend from the close, not from the candle range', () => {
    // Close rises while the intraday high falls.
    const [, second] = buildTrendPoints([candle('d1', 10, { high: 50 }), candle('d2', 11, { high: 12 })], (d) => d);
    expect(second.trend).toBe('up');
  });

  it('uses the bare-date-aware formatter by default', () => {
    const [point] = buildTrendPoints([candle('2026-10-19', 1)]);
    expect(point.label).toMatch(/Oct 19, 2026/);
  });
});

describe('computeHighLow', () => {
  it('picks the highest high and lowest low across the candles, with the candle timestamps', () => {
    expect(
      computeHighLow([
        candle('2026-10-19', 275.2, { high: 276.0, low: 271.1 }),
        candle('2026-10-20', 274.8, { high: 275.5, low: 270.4 }),
        candle('2026-10-21', 282.5, { high: 283.1, low: 274.0 }),
      ]),
    ).toEqual({
      high: { price: 283.1, occurredAt: '2026-10-21' },
      low: { price: 270.4, occurredAt: '2026-10-20' },
    });
  });

  it('is based on the candle extremes, not the closes', () => {
    // The day with the highest close is not the day with the highest trade.
    const { high, low } = computeHighLow([
      candle('2026-10-19', 100, { high: 130, low: 90 }),
      candle('2026-10-20', 120, { high: 121, low: 80 }),
    ]);
    expect(high).toEqual({ price: 130, occurredAt: '2026-10-19' });
    expect(low).toEqual({ price: 80, occurredAt: '2026-10-20' });
  });

  it('resolves ties in favour of the earliest candle', () => {
    const { high, low } = computeHighLow([
      candle('2026-10-19', 1, { high: 5, low: 1 }),
      candle('2026-10-20', 1, { high: 5, low: 1 }),
    ]);
    expect(high.occurredAt).toBe('2026-10-19');
    expect(low.occurredAt).toBe('2026-10-19');
  });

  it('handles a single candle', () => {
    expect(computeHighLow([candle('2026-10-19', 3, { high: 4, low: 2 })])).toEqual({
      high: { price: 4, occurredAt: '2026-10-19' },
      low: { price: 2, occurredAt: '2026-10-19' },
    });
  });

  it('rejects an empty list', () => {
    expect(() => computeHighLow([])).toThrow(/empty series/);
  });
});

describe('summarizePerformance', () => {
  const series: PriceSeries = {
    symbol: 'V',
    period: 'WEEK',
    interval: '1d',
    records: [
      candle('2026-10-19', 275.2, { high: 276.0, low: 271.1 }),
      candle('2026-10-20', 274.8, { high: 275.5, low: 270.4 }),
      candle('2026-10-21', 282.5, { high: 283.1, low: 274.0 }),
    ],
  };

  it('turns the series into the view model, deriving the high/low from the candles', () => {
    const perf = summarizePerformance(series, (d) => d);
    expect(perf).toMatchObject({
      symbol: 'V',
      period: 'WEEK',
      interval: '1d',
      latestPrice: 282.5,
      changePercent: 2.65,
      high: { price: 283.1, occurredAt: '2026-10-21' },
      low: { price: 270.4, occurredAt: '2026-10-20' },
    });
    expect(perf.points.map((p) => p.price)).toEqual([275.2, 274.8, 282.5]);
    expect(perf.points.map((p) => p.trend)).toEqual(['neutral', 'down', 'up']);
    expect(perf.points[0].label).toBe('2026-10-19');
  });

  it('carries the reference date and window through when present, and omits them otherwise', () => {
    expect(summarizePerformance(series)).not.toHaveProperty('referenceDate');
    const anchored = summarizePerformance({ ...series, referenceDate: '2026-10-21', window: { start: '2026-10-19', end: '2026-10-21' } });
    expect(anchored).toMatchObject({ referenceDate: '2026-10-21', window: { start: '2026-10-19', end: '2026-10-21' } });
  });

  it('rejects an empty series', () => {
    expect(() => summarizePerformance({ ...series, records: [] })).toThrow(/No price history available for V/);
  });
});
