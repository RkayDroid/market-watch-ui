import { describe, expect, it } from 'vitest';
import detailAapl from '../../public/data/detail-AAPL.json';
import { InvalidPayloadError } from './payload.ts';
import {
  buildCreateWatchlistRequest,
  buildUpdateWatchlistRequest,
  parseCreateWatchlistResponse,
  parseWatchlistDetails,
  parseWatchlistListing,
  toCreatedWatchlist,
} from './watchlistPayload.ts';
import { toWatchlist } from '../types/watchlist.ts';

describe('request builders', () => {
  it('POST /watchlist body carries the user, the name and the symbols as sent', () => {
    expect(buildCreateWatchlistRequest('alice', { name: 'Tech', symbols: ['AAPL', 'MSFT'] })).toEqual({
      userId: 'alice',
      watchListName: 'Tech',
      symbols: ['AAPL', 'MSFT'],
    });
  });

  it('PUT /watchlist body is a full replacement keyed by id', () => {
    expect(buildUpdateWatchlistRequest('k3Zp9QaB', { name: 'Tech', symbols: ['MSFT', 'AAPL'] })).toEqual({
      watchListId: 'k3Zp9QaB',
      watchListName: 'Tech',
      symbols: ['MSFT', 'AAPL'],
    });
  });
});

describe('parseCreateWatchlistResponse', () => {
  it('reads the assigned id (the documented example)', () => {
    const created = parseCreateWatchlistResponse({ userId: 'alice', watchListName: 'Tech', watchListId: 'k3Zp9QaB' });
    expect(created).toEqual({ id: 'k3Zp9QaB', userId: 'alice', name: 'Tech' });
    expect(toCreatedWatchlist(created, { name: 'Tech', symbols: ['AAPL', 'MSFT'] })).toEqual({
      id: 'k3Zp9QaB',
      name: 'Tech',
      symbols: ['AAPL', 'MSFT'],
    });
  });

  it.each([
    ['not an object', []],
    ['missing id', { watchListName: 'Tech' }],
    ['missing name', { watchListId: 'x' }],
  ])('rejects %s', (_label, payload) => {
    expect(() => parseCreateWatchlistResponse(payload)).toThrow(InvalidPayloadError);
  });
});

describe('parseWatchlistDetails', () => {
  const served = {
    watchListId: 'k3Zp9QaB',
    userId: 'u1',
    watchListName: 'Tech',
    count: 2,
    symbols: {
      '2': { ticker: 'NOPE', error: 'Ticker NOPE not found.' },
      '1': detailAapl,
    },
  };

  it('maps the documented example: entries sorted by position, details parsed like /stock, errors kept', () => {
    const details = parseWatchlistDetails(served);
    expect(details.id).toBe('k3Zp9QaB');
    expect(details.userId).toBe('u1');
    expect(details.name).toBe('Tech');
    expect(details.entries.map((e) => [e.position, e.ticker])).toEqual([
      [1, 'AAPL'],
      [2, 'NOPE'],
    ]);
    expect(details.entries[0].details).toMatchObject({ symbol: 'AAPL', sector: 'Technology', fulldayPrice: 343.83 });
    expect(details.entries[0].error).toBeUndefined();
    expect(details.entries[1]).toEqual({ position: 2, ticker: 'NOPE', error: 'Ticker NOPE not found.' });
    expect(toWatchlist(details)).toEqual({ id: 'k3Zp9QaB', name: 'Tech', symbols: ['AAPL', 'NOPE'] });
  });

  it('tolerates a missing symbols map and count', () => {
    expect(parseWatchlistDetails({ watchListId: 'x', watchListName: 'Empty' }).entries).toEqual([]);
  });

  it.each([
    ['a count that disagrees', { ...served, count: 3 }],
    ['a non-positional key', { ...served, symbols: { a: detailAapl } }],
    ['an entry without a ticker', { ...served, count: 1, symbols: { '1': { sector: 'x' } } }],
    ['an error entry without a ticker', { ...served, count: 1, symbols: { '1': { error: 'nope' } } }],
    ['symbols that are not an object', { ...served, symbols: [detailAapl] }],
  ])('rejects %s', (_label, payload) => {
    expect(() => parseWatchlistDetails(payload)).toThrow(InvalidPayloadError);
  });
});

describe('parseWatchlistListing', () => {
  const served = {
    userId: 'alice',
    count: 2,
    watchlists: [
      { watchListId: 'k3Zp9QaB', watchListName: 'Tech' },
      { watchListId: 'Qw8rT2vM', watchListName: 'ETFs' },
    ],
  };

  it('maps the documented example, keeping the served order', () => {
    expect(parseWatchlistListing(served)).toEqual({
      userId: 'alice',
      watchlists: [
        { id: 'k3Zp9QaB', name: 'Tech' },
        { id: 'Qw8rT2vM', name: 'ETFs' },
      ],
    });
  });

  it('tolerates a user with no lists and no count', () => {
    expect(parseWatchlistListing({ userId: 'bob' })).toEqual({ userId: 'bob', watchlists: [] });
    expect(parseWatchlistListing({ userId: 'bob', count: 0, watchlists: [] }).watchlists).toEqual([]);
  });

  it.each([
    ['not an object', 'x'],
    ['watchlists not an array', { ...served, watchlists: {} }],
    ['an entry without an id', { ...served, watchlists: [{ watchListName: 'Tech' }], count: 1 }],
    ['an entry without a name', { ...served, watchlists: [{ watchListId: 'x' }], count: 1 }],
    ['a duplicated id', { ...served, watchlists: [served.watchlists[0], served.watchlists[0]] }],
    ['a count that disagrees', { ...served, count: 3 }],
  ])('rejects %s', (_label, payload) => {
    expect(() => parseWatchlistListing(payload)).toThrow(InvalidPayloadError);
  });
});
