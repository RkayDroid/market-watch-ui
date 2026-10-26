import { describe, expect, it } from 'vitest';
import { OFFLINE_SYMBOLS } from './providers/LocalStockProvider.ts';
import { parseStockDetails } from './stockDetails.ts';

/**
 * Guards the offline detail fixtures: every `public/data/detail-{SYMBOL}.json`
 * must parse under the live contract, and its symbol must match its file name
 * (the provider resolves the file by symbol) and the capture it was copied from.
 */
const served = import.meta.glob<unknown>('../../public/data/detail-*.json', { eager: true, import: 'default' });
const captured = import.meta.glob<unknown>('../../json/detail-*.json', { eager: true, import: 'default' });

const symbolFromPath = (path: string) => /detail-(.+)\.json$/.exec(path)![1];

const servedBySymbol = Object.fromEntries(Object.entries(served).map(([p, v]) => [symbolFromPath(p), v]));
const capturedBySymbol = Object.fromEntries(Object.entries(captured).map(([p, v]) => [symbolFromPath(p), v]));

describe('public/data/detail-*.json', () => {
  it('ships the captured live responses', () => {
    expect(Object.keys(servedBySymbol).sort()).toEqual(['AAPL', 'GOOG', 'META']);
    expect(Object.keys(servedBySymbol).sort()).toEqual(Object.keys(capturedBySymbol).sort());
  });

  it('is exactly the list the offline provider suggests on a miss (OFFLINE_SYMBOLS)', () => {
    expect([...OFFLINE_SYMBOLS].sort()).toEqual(Object.keys(servedBySymbol).sort());
  });

  it.each(Object.keys(servedBySymbol))('%s parses, matches its file name and its capture', (symbol) => {
    const details = parseStockDetails(servedBySymbol[symbol]);
    expect(details.symbol).toBe(symbol);
    expect(details).toMatchObject({
      displayName: expect.any(String),
      longName: expect.any(String),
      sector: expect.any(String),
      exchange: expect.any(String),
      market: expect.any(String),
      currency: expect.any(String),
      language: expect.any(String),
      fulldayPrice: expect.any(Number),
    });
    expect(servedBySymbol[symbol]).toEqual(capturedBySymbol[symbol]);
  });
});
