import { describe, expect, it } from 'vitest';
import highLowDay from '../../json/highlow-AAPL-DAY.json';
import highLowYear from '../../json/highlow-META-YEAR.json';
import { parseHighLow } from './highLow.ts';
import { InvalidPayloadError } from './payload.ts';

describe('parseHighLow', () => {
  it('maps captured payloads (timestamped and bare-date variants)', () => {
    expect(parseHighLow(highLowDay)).toEqual({
      symbol: 'AAPL',
      period: 'DAY',
      high: { price: 351.73, occurredAt: '2026-10-23T09:30:00-04:00' },
      low: { price: 345.75, occurredAt: '2026-10-23T13:25:00-04:00' },
    });
    expect(parseHighLow(highLowYear)).toEqual({
      symbol: 'META',
      period: 'YEAR',
      high: { price: 779.82, occurredAt: '2026-09-24' },
      low: { price: 519.3684, occurredAt: '2026-03-27' },
    });
  });

  it('accepts ticker as an alias for symbol and falls back to the expected values', () => {
    expect(parseHighLow({ ticker: 'x', period: 'DAY', high: 2, highOccured: '2026-10-19', low: 1, lowOccured: '2026-10-19' }).symbol).toBe('X');
    const hl = parseHighLow({ high: 2, highOccured: '2026-10-19', low: 1, lowOccured: '2026-10-19' }, { symbol: 'AAPL', period: 'DAY' });
    expect(hl).toMatchObject({ symbol: 'AAPL', period: 'DAY' });
  });

  const ok = { symbol: 'X', period: 'DAY', high: 2, highOccured: '2026-10-19', low: 1, lowOccured: '2026-10-19' };

  it.each([
    ['null body', null, undefined, 'body is not an object'],
    ['no symbol', { ...ok, symbol: undefined }, undefined, '"symbol" is missing'],
    ['unknown period', { ...ok, period: 'DECADE' }, undefined, '"period" DECADE is not recognised'],
    ['wrong symbol', ok, { symbol: 'AAPL' }, '"symbol" is X, expected AAPL'],
    ['wrong period', ok, { period: 'WEEK' as const }, '"period" is DAY, expected WEEK'],
    ['missing high', { ...ok, high: undefined }, undefined, '"high" is missing'],
    ['bad low', { ...ok, low: 'abc' }, undefined, '"low" is not a number'],
    ['low above high', { ...ok, low: 3 }, undefined, '"low" (3) exceeds "high" (2)'],
    ['bad highOccured', { ...ok, highOccured: 'nope' }, undefined, '"highOccured" is not a valid date'],
    ['missing lowOccured', { ...ok, lowOccured: undefined }, undefined, '"lowOccured" is missing'],
  ])('rejects %s', (_name, payload, expected, reason) => {
    let caught: unknown;
    try {
      parseHighLow(payload, expected);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(InvalidPayloadError);
    expect((caught as InvalidPayloadError).subject).toBe('high/low');
    expect((caught as InvalidPayloadError).reason).toBe(reason);
  });
});
