import { describe, expect, it } from 'vitest';
import { OFFLINE_SYMBOLS } from '../data/providers/LocalStockProvider.ts';
import { SYMBOL_PATTERN } from '../types/watchlist.ts';
import { QUICK_SYMBOLS } from './quickLinks.ts';

describe('QUICK_SYMBOLS', () => {
  it('only lists symbols that work offline, each once, with a name', () => {
    const symbols = QUICK_SYMBOLS.map((q) => q.symbol);
    expect(new Set(symbols).size).toBe(symbols.length);
    for (const { symbol, name } of QUICK_SYMBOLS) {
      expect(OFFLINE_SYMBOLS).toContain(symbol);
      expect(SYMBOL_PATTERN.test(symbol)).toBe(true);
      expect(name.trim()).not.toBe('');
    }
  });

  it('covers every offline symbol', () => {
    expect([...QUICK_SYMBOLS.map((q) => q.symbol)].sort()).toEqual([...OFFLINE_SYMBOLS].sort());
  });
});
