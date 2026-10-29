import { describe, expect, it } from 'vitest';
import detailBrkA from '../../public/data/detail-BRK.A.json';
import detailGoog from '../../public/data/detail-GOOG.json';
import { InvalidPayloadError } from './payload.ts';
import { parseStockDetails } from './stockDetails.ts';

describe('parseStockDetails', () => {
  it('maps every field of the captured live payload', () => {
    expect(parseStockDetails(detailGoog)).toEqual({
      symbol: 'GOOG',
      displayName: 'Alphabet',
      longName: 'Alphabet Inc.',
      sector: 'Communication Services',
      exchange: 'NMS',
      market: 'us_market',
      currency: 'USD',
      language: 'en-US',
      fulldayPrice: 321.89,
    });
  });

  it('does not carry over the redundant ticker field or unknown keys', () => {
    const details = parseStockDetails({ symbol: 'X', ticker: 'X', somethingNew: 1 });
    expect(details).toEqual({ symbol: 'X' });
  });

  it('takes the symbol from ticker (the identifier the API accepts), falling back to symbol, and upper-cases', () => {
    expect(parseStockDetails({ ticker: 'msft' }).symbol).toBe('MSFT');
    expect(parseStockDetails({ symbol: ' nflx ' }).symbol).toBe('NFLX');
    expect(parseStockDetails({ symbol: 'OTHER', ticker: ' nflx ' }).symbol).toBe('NFLX');
    // The captured BRK.A payload spells its own symbol differently from the requested ticker.
    expect(parseStockDetails(detailBrkA)).toMatchObject({ symbol: 'BRK.A', displayName: 'Berkshire Hathaway' });
  });

  it('treats null, blank and missing optional fields as absent', () => {
    expect(parseStockDetails({ symbol: 'X', sector: null, exchange: '  ', fulldayPrice: null })).toEqual({
      symbol: 'X',
    });
  });

  it('coerces numeric strings for fulldayPrice and trims strings', () => {
    expect(parseStockDetails({ symbol: 'X', fulldayPrice: '12.5', sector: ' Tech ' })).toEqual({
      symbol: 'X',
      fulldayPrice: 12.5,
      sector: 'Tech',
    });
  });

  it.each([
    ['null body', null, 'body is not an object'],
    ['array body', [], 'body is not an object'],
    ['string body', 'nope', 'body is not an object'],
    ['no symbol or ticker', { sector: 'Tech' }, '"symbol" is missing'],
    ['blank symbol and ticker', { symbol: '', ticker: ' ' }, '"symbol" is missing'],
    ['non-string symbol', { symbol: 42 }, '"symbol" is not a string'],
    ['non-string sector', { symbol: 'X', sector: { a: 1 } }, '"sector" is not a string'],
    ['non-numeric price', { symbol: 'X', fulldayPrice: 'abc' }, '"fulldayPrice" is not a number'],
    ['boolean price', { symbol: 'X', fulldayPrice: true }, '"fulldayPrice" is not a number'],
    ['infinite price', { symbol: 'X', fulldayPrice: Infinity }, '"fulldayPrice" is not a number'],
  ])('rejects %s', (_name, payload, reason) => {
    let caught: unknown;
    try {
      parseStockDetails(payload);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(InvalidPayloadError);
    expect((caught as InvalidPayloadError).reason).toBe(reason);
    expect((caught as Error).message).toBe(`Invalid stock details: ${reason}.`);
  });
});
