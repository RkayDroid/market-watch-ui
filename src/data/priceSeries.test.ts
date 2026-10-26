import { describe, expect, it } from 'vitest';
import historyWeek from '../../json/history-AAPL-WEEK.json';
import historyDay from '../../json/history-GOOG-DAY.json';
import { InvalidPayloadError } from './payload.ts';
import { parsePriceSeries } from './priceSeries.ts';

describe('parsePriceSeries', () => {
  it('maps a captured daily-interval payload', () => {
    const series = parsePriceSeries(historyWeek);
    expect(series).toMatchObject({ symbol: 'AAPL', period: 'WEEK', interval: '1d' });
    expect(series.records).toHaveLength(5);
    expect(series.records[0]).toEqual({ date: '2026-10-19', rate: 342.94 });
    expect(series.records[4]).toEqual({ date: '2026-10-23', rate: 347.73 });
  });

  it('keeps full timestamps of the hourly DAY payload verbatim', () => {
    const series = parsePriceSeries(historyDay);
    expect(series).toMatchObject({ symbol: 'GOOG', period: 'DAY', interval: '1h' });
    expect(series.records[0]).toEqual({ date: '2026-10-22T09:30:00-04:00', rate: 323.42 });
    expect(series.records).toHaveLength(14);
  });

  it('sorts samples chronologically and coerces numeric strings', () => {
    const series = parsePriceSeries({
      ticker: 'x',
      period: 'WEEK',
      data: [
        { datetime: '2026-10-21', price: '3' },
        { datetime: '2026-10-19', price: 1 },
        { datetime: '2026-10-20', price: 2 },
      ],
    });
    expect(series.symbol).toBe('X');
    expect(series.interval).toBe('');
    expect(series.records.map((r) => r.rate)).toEqual([1, 2, 3]);
  });

  it('falls back to the expected symbol/period when the payload omits them', () => {
    const series = parsePriceSeries({ data: [{ datetime: '2026-10-19', price: 1 }] }, { symbol: 'AAPL', period: 'WEEK' });
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
    ['bad datetime', { ticker: 'X', period: 'DAY', data: [{ datetime: 'nope', price: 1 }] }, undefined, 'data[0].datetime'],
    ['bad price', { ticker: 'X', period: 'DAY', data: [{ datetime: '2026-10-19', price: 'abc' }] }, undefined, 'data[0].price'],
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
