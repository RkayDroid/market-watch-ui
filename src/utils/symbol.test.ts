import { describe, expect, it } from 'vitest';
import { normalizeSymbol } from './symbol.ts';

describe('normalizeSymbol', () => {
  it('trims and upper-cases', () => {
    expect(normalizeSymbol('  aapl ')).toBe('AAPL');
    expect(normalizeSymbol('brk.b')).toBe('BRK.B');
  });

  it('maps blank input to an empty string', () => {
    expect(normalizeSymbol('   ')).toBe('');
  });
});
