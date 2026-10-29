import { describe, expect, it } from 'vitest';
import historyWeek from '../../public/data/historic-AAPL-WEEK.json';
import historyDay from '../../public/data/historic-GOOG-DAY.json';
import historyBrkA from '../../public/data/historic-BRK.A-MONTH.json';
import historyWeekRef1 from '../../public/data/historic-AAPL-WEEK-1.json';
import historyWeekRef2 from '../../public/data/historic-AAPL-WEEK-2.json';
import { InvalidPayloadError } from './payload.ts';
import { parsePriceSeries } from './priceSeries.ts';

const candle = { datetime: '2026-10-19', open: 1, high: 2, low: 0.5, close: 1.5 };

describe('parsePriceSeries', () => {
  it('maps a captured daily-interval payload to OHLC candles', () => {
    const series = parsePriceSeries(historyWeek);
    expect(series).toMatchObject({ symbol: 'AAPL', period: 'WEEK', interval: '1d' });
    expect(series.records).toHaveLength(5);
    expect(series.records[0]).toEqual({ date: '2026-10-22', open: 344.94, high: 348.36, low: 342.28, close: 348.22 });
    expect(series.records[4]).toEqual({ date: '2026-10-28', open: 346.885, high: 347.18, low: 343.53, close: 343.83 });
  });

  it('keeps full timestamps of the hourly DAY payload verbatim', () => {
    const series = parsePriceSeries(historyDay);
    expect(series).toMatchObject({ symbol: 'GOOG', period: 'DAY', interval: '1h' });
    expect(series.records[0]).toEqual({
      date: '2026-10-28T09:30:00-04:00',
      open: 319.88,
      high: 322.5992,
      low: 319.68,
      close: 320.99,
    });
    expect(series.records).toHaveLength(7);
  });

  it('identifies the series by ticker (the requested identifier), not the provider symbol', () => {
    // The BRK.A capture reports ticker "BRK.A" and symbol "BRK-A".
    const series = parsePriceSeries(historyBrkA, { symbol: 'BRK.A', period: 'MONTH' });
    expect(series.symbol).toBe('BRK.A');
    expect(series.records).toHaveLength(22);
  });

  it('carries the reference date and window of a plain response, ignoring count', () => {
    const series = parsePriceSeries(historyWeek);
    expect(series.referenceDate).toBe('2026-10-28');
    expect(series.window).toEqual({ start: '2026-10-22', end: '2026-10-28' });
    expect(series).not.toHaveProperty('count');
  });

  describe('responses to a referenceDate request (results map)', () => {
    it('unwraps the entry for the requested date', () => {
      const series = parsePriceSeries(historyWeekRef1, { symbol: 'AAPL', period: 'WEEK', referenceDate: '2025-10-10' });
      expect(series).toMatchObject({ symbol: 'AAPL', period: 'WEEK', interval: '1d', referenceDate: '2025-10-10' });
      expect(series.window).toEqual({ start: '2025-10-06', end: '2025-10-10' });
      expect(series.records).toHaveLength(5);
      expect(series.records[4]).toEqual({ date: '2025-10-10', open: 254.0017, high: 255.4364, low: 243.102, close: 244.3673 });
    });

    it('takes a single-entry map as is when no date was requested, reporting the date it is for', () => {
      const series = parsePriceSeries(historyWeekRef2, { symbol: 'AAPL', period: 'WEEK' });
      expect(series.referenceDate).toBe('2026-02-02');
      expect(series.window?.end).toBe('2026-02-02');
      expect(series.records.map((r) => r.close)).toEqual([257.5689, 255.7439, 257.5789, 258.7756, 269.2771]);
    });

    it('refuses an entry for a different date than requested', () => {
      expect(() => parsePriceSeries(historyWeekRef2, { referenceDate: '2025-10-10' })).toThrow(
        '"results" has no entry for 2025-10-10 (has 2026-02-02)',
      );
    });

    it('refuses to guess between several windows', () => {
      const two = { ticker: 'X', period: 'DAY', results: { '2026-01-01': { data: [candle] }, '2026-01-02': { data: [candle] } } };
      expect(() => parsePriceSeries(two)).toThrow('"results" holds several windows (2026-01-01, 2026-01-02) and none was requested');
      expect(parsePriceSeries(two, { referenceDate: '2026-01-02' }).referenceDate).toBe('2026-01-02');
    });

    it('checks a plain response against the requested date too', () => {
      expect(() => parsePriceSeries(historyWeek, { referenceDate: '2025-10-10' })).toThrow(
        '"referenceDate" is 2026-10-28, expected 2025-10-10',
      );
    });
  });

  it('sorts samples chronologically and coerces numeric strings', () => {
    const series = parsePriceSeries({
      ticker: 'x',
      period: 'WEEK',
      data: [
        { datetime: '2026-10-21', open: '3', high: '3.5', low: '2.5', close: '3' },
        { ...candle, datetime: '2026-10-19', close: 1 },
        { ...candle, datetime: '2026-10-20', close: 2 },
      ],
    });
    expect(series.symbol).toBe('X');
    expect(series.interval).toBe('');
    expect(series.records.map((r) => r.close)).toEqual([1, 2, 3]);
    expect(series.records[2]).toEqual({ date: '2026-10-21', open: 3, high: 3.5, low: 2.5, close: 3 });
  });

  it('falls back to the expected symbol/period when the payload omits them', () => {
    const series = parsePriceSeries({ data: [candle] }, { symbol: 'AAPL', period: 'WEEK' });
    expect(series).toMatchObject({ symbol: 'AAPL', period: 'WEEK' });
  });

  it.each([
    ['null body', null, undefined, 'body is not an object'],
    ['no ticker', { period: 'DAY', data: [] }, undefined, '"ticker" is missing'],
    ['no period', { ticker: 'X', data: [] }, undefined, '"period" is missing'],
    ['unknown period', { ticker: 'X', period: 'DECADE', data: [] }, undefined, '"period" DECADE is not recognised'],
    ['wrong symbol', { ticker: 'GOOG', period: 'DAY', data: [] }, { symbol: 'AAPL' }, '"ticker" is GOOG, expected AAPL'],
    ['wrong period', { ticker: 'X', period: 'DAY', data: [] }, { period: 'WEEK' as const }, '"period" is DAY, expected WEEK'],
    ['data not array', { ticker: 'X', period: 'DAY', data: {} }, undefined, '"data" is not an array'],
    ['empty data', { ticker: 'X', period: 'DAY', data: [] }, undefined, '"data" is empty'],
    ['point not object', { ticker: 'X', period: 'DAY', data: [1] }, undefined, 'data[0] is not an object'],
    ['bad datetime', { ticker: 'X', period: 'DAY', data: [{ ...candle, datetime: 'nope' }] }, undefined, 'data[0].datetime'],
    ['missing open', { ticker: 'X', period: 'DAY', data: [{ ...candle, open: undefined }] }, undefined, 'data[0].open" is missing'],
    ['bad high', { ticker: 'X', period: 'DAY', data: [{ ...candle, high: 'abc' }] }, undefined, 'data[0].high" is not a number'],
    ['missing low', { ticker: 'X', period: 'DAY', data: [{ ...candle, low: null }] }, undefined, 'data[0].low" is missing'],
    ['bad close', { ticker: 'X', period: 'DAY', data: [candle, { ...candle, close: true }] }, undefined, 'data[1].close" is not a number'],
    ['legacy price-only point', { ticker: 'X', period: 'DAY', data: [{ datetime: '2026-10-19', price: 1 }] }, undefined, 'data[0].open" is missing'],
    ['inverted candle', { ticker: 'X', period: 'DAY', data: [{ ...candle, low: 3 }] }, undefined, 'data[0].low (3) exceeds data[0].high (2)'],
    ['results not object', { ticker: 'X', period: 'DAY', results: [] }, undefined, '"results" is not an object'],
    ['results empty', { ticker: 'X', period: 'DAY', results: {} }, undefined, '"results" is empty'],
    ['results entry not object', { ticker: 'X', period: 'DAY', results: { '2026-01-01': 1 } }, undefined, 'results["2026-01-01"] is not an object'],
    ['results entry without data', { ticker: 'X', period: 'DAY', results: { '2026-01-01': {} } }, undefined, '"data" is not an array'],
    ['bad window', { ticker: 'X', period: 'DAY', window: { start: 'x', end: '2026-01-01' }, data: [candle] }, undefined, '"window.start" is not a valid date'],
    ['window not object', { ticker: 'X', period: 'DAY', window: 'x', data: [candle] }, undefined, '"window" is not an object'],
  ])('rejects %s', (_name, payload, expected, reason) => {
    let caught: unknown;
    try {
      parsePriceSeries(payload, expected);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(InvalidPayloadError);
    expect((caught as InvalidPayloadError).subject).toBe('price history');
    expect((caught as InvalidPayloadError).reason).toContain(reason);
  });
});
