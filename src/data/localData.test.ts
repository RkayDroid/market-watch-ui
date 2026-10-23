import { describe, expect, it } from 'vitest';
import { parsePriceTable } from './csv/parsePriceRecords.ts';

/**
 * Guards the shipped data file itself: every required ticker is present with a
 * complete, chronological 24-hour series.
 */
import csv from '../../public/local-data.csv?raw';

const table = parsePriceTable(csv);

const EXPECTED_SYMBOLS = ['AAPL', 'GOOG', 'META', 'NFLX', 'V'];

describe('public/local-data.csv', () => {
  it('contains exactly the expected tickers', () => {
    expect(Object.keys(table).sort()).toEqual(EXPECTED_SYMBOLS);
  });

  it.each(EXPECTED_SYMBOLS)('%s has 24 consecutive hourly points', (symbol) => {
    const series = table[symbol];
    expect(series).toHaveLength(24);
    for (let i = 1; i < series.length; i++) {
      const delta = Date.parse(series[i].date) - Date.parse(series[i - 1].date);
      expect(delta).toBe(60 * 60 * 1000);
    }
    expect(series[0].date).toBe('2026-10-21T15:00:00.000Z');
  });

  it('preserves the original in-code V and AAPL values', () => {
    expect(table.V[0]).toEqual({ date: '2026-10-21T15:00:00.000Z', rate: 275.2 });
    expect(table.V[23]).toEqual({ date: '2026-10-22T14:00:00.000Z', rate: 282.5 });
    expect(table.AAPL[0]).toEqual({ date: '2026-10-21T15:00:00.000Z', rate: 220.1 });
    expect(table.AAPL[23]).toEqual({ date: '2026-10-22T14:00:00.000Z', rate: 227.5 });
  });
});
