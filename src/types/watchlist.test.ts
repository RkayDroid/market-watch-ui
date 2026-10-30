import { describe, expect, it } from 'vitest';
import { SYMBOL_PATTERN, WATCHLIST_MAX_SYMBOLS, WATCHLIST_NAME_MAX_LENGTH } from './watchlist.ts';

describe('SYMBOL_PATTERN', () => {
  it.each(['AAPL', 'V', 'BRK.A', 'BRK-A', 'RDS.B', 'X', '7203', 'ABCDEFGHIJ'])('accepts %s', (symbol) => {
    expect(SYMBOL_PATTERN.test(symbol)).toBe(true);
  });

  it.each(['', 'aapl', '.A', '-A', 'AA PL', 'AAPL!', 'ABCDEFGHIJK', 'A/B'])('rejects %j', (symbol) => {
    expect(SYMBOL_PATTERN.test(symbol)).toBe(false);
  });
});

describe('watchlist limits', () => {
  it('are sensible and positive', () => {
    expect(WATCHLIST_NAME_MAX_LENGTH).toBeGreaterThanOrEqual(20);
    expect(WATCHLIST_MAX_SYMBOLS).toBeGreaterThanOrEqual(10);
  });
});
