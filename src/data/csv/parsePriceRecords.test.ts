import { describe, expect, it } from 'vitest';
import { CsvParseError } from './parseCsv.ts';
import {
  groupBySymbol,
  normalizeSymbol,
  parsePriceRow,
  parsePriceTable,
} from './parsePriceRecords.ts';

describe('normalizeSymbol', () => {
  it('trims and upper-cases', () => {
    expect(normalizeSymbol('  aapl ')).toBe('AAPL');
  });
});

describe('parsePriceRow', () => {
  const row = (values: Record<string, string>, line = 2) => ({ line, values });

  it('parses a valid row and canonicalises the date', () => {
    expect(
      parsePriceRow(row({ symbol: 'goog', date: '2026-10-21T15:00:00Z', rate: '182.40' })),
    ).toEqual({ symbol: 'GOOG', date: '2026-10-21T15:00:00.000Z', rate: 182.4 });
  });

  it.each([
    ['empty symbol', { symbol: '', date: '2026-10-21T15:00:00Z', rate: '1' }, /symbol must not be empty/],
    ['bad date', { symbol: 'V', date: 'yesterday', rate: '1' }, /invalid date "yesterday"/],
    ['bad rate', { symbol: 'V', date: '2026-10-21T15:00:00Z', rate: 'abc' }, /invalid rate "abc"/],
    ['empty rate', { symbol: 'V', date: '2026-10-21T15:00:00Z', rate: '' }, /invalid rate ""/],
  ])('rejects %s', (_name, values, pattern) => {
    expect(() => parsePriceRow(row(values, 7))).toThrow(pattern);
    expect(() => parsePriceRow(row(values, 7))).toThrow(/line 7/);
  });
});

describe('groupBySymbol', () => {
  it('groups by symbol and sorts each series chronologically', () => {
    const table = groupBySymbol([
      { symbol: 'V', date: '2026-10-21T16:00:00.000Z', rate: 2 },
      { symbol: 'AAPL', date: '2026-10-21T15:00:00.000Z', rate: 10 },
      { symbol: 'V', date: '2026-10-21T15:00:00.000Z', rate: 1 },
    ]);
    expect(Object.keys(table).sort()).toEqual(['AAPL', 'V']);
    expect(table.V.map((r) => r.rate)).toEqual([1, 2]);
    expect(table.AAPL).toEqual([{ date: '2026-10-21T15:00:00.000Z', rate: 10 }]);
  });
});

describe('parsePriceTable', () => {
  it('parses a full CSV document', () => {
    const csv = [
      'symbol,date,rate',
      'V,2026-10-21T15:00:00Z,275.20',
      'V,2026-10-21T16:00:00Z,274.80',
      'META,2026-10-21T15:00:00Z,588.30',
    ].join('\n');

    const table = parsePriceTable(csv);
    expect(table.V).toEqual([
      { date: '2026-10-21T15:00:00.000Z', rate: 275.2 },
      { date: '2026-10-21T16:00:00.000Z', rate: 274.8 },
    ]);
    expect(table.META).toHaveLength(1);
  });

  it('tolerates extra columns and any column order', () => {
    const table = parsePriceTable('rate,note,symbol,date\n1,hello,NFLX,2026-10-21T15:00:00Z');
    expect(table.NFLX).toEqual([{ date: '2026-10-21T15:00:00.000Z', rate: 1 }]);
  });

  it('returns an empty table for an empty file', () => {
    expect(parsePriceTable('')).toEqual({});
  });

  it('fails when required columns are missing', () => {
    expect(() => parsePriceTable('symbol,price\nV,1')).toThrow(CsvParseError);
    expect(() => parsePriceTable('symbol,price\nV,1')).toThrow(/missing required column\(s\): date, rate/);
  });
});
