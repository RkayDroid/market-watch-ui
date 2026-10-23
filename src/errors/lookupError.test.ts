import { describe, expect, it } from 'vitest';
import { LiveApiError, SymbolNotFoundError } from '../data/providers/PriceProvider.ts';
import { InvalidSymbolError } from '../services/stockService.ts';
import { GENERIC_LOOKUP_ERROR, toLookupError } from './lookupError.ts';

describe('toLookupError', () => {
  it('describes a missing symbol with suggestions when available', () => {
    const err = toLookupError(
      new SymbolNotFoundError('TSLA', { source: 'the local data file', availableSymbols: ['AAPL', 'V'] }),
    );
    expect(err).toEqual({
      title: 'Symbol not found',
      message: '"TSLA" is not available from this data source.',
      hint: 'Try one of the available symbols:',
      suggestedSymbols: ['AAPL', 'V'],
    });
  });

  it('omits suggestions when the source cannot enumerate symbols', () => {
    const err = toLookupError(new SymbolNotFoundError('X', { source: 'the live API' }));
    expect(err.hint).toBeUndefined();
    expect(err.suggestedSymbols).toBeUndefined();
  });

  it.each([
    ['unreachable', undefined, 'Live API unreachable', true],
    ['timeout', undefined, 'Live API timed out', true],
    ['http', 503, 'Live API error (HTTP 503)', false],
    ['malformed', undefined, 'Unexpected API response', false],
  ] as const)('maps LiveApiError kind=%s', (kind, status, title, hasHint) => {
    const err = toLookupError(new LiveApiError(kind, 'detail', { status }));
    expect(err.title).toBe(title);
    expect(err.message).toBe('detail');
    expect(Boolean(err.hint)).toBe(hasHint);
    if (hasHint) expect(err.hint).toContain('VITE_LIVE_API_BASE_URL');
  });

  it('maps InvalidSymbolError', () => {
    expect(toLookupError(new InvalidSymbolError())).toEqual({
      title: 'Symbol required',
      message: 'Please enter a stock symbol.',
    });
  });

  it('falls back for generic errors and non-errors', () => {
    expect(toLookupError(new Error('boom'))).toEqual({ ...GENERIC_LOOKUP_ERROR, message: 'boom' });
    expect(toLookupError(new Error(''))).toEqual(GENERIC_LOOKUP_ERROR);
    expect(toLookupError('str')).toEqual(GENERIC_LOOKUP_ERROR);
  });
});
