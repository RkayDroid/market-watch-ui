import { describe, expect, it } from 'vitest';
import type { Watchlist } from '../types/watchlist.ts';
import {
  addWatchlist,
  appendSymbols,
  InvalidWatchlistError,
  isDraftValid,
  isEditUnchanged,
  moveSymbol,
  parseSymbolList,
  prepareNewWatchlist,
  prepareWatchlistEdit,
  removeSymbolAt,
  removeWatchlist,
  replaceWatchlist,
  toggleSymbolInText,
  validateWatchlistDraft,
  validateWatchlistEdit,
  validateSymbols,
  validateWatchlistName,
} from './watchlistService.ts';

const existing: Watchlist[] = [{ id: '1', name: 'Tech', symbols: ['AAPL'] }];

describe('parseSymbolList', () => {
  it('splits on commas, whitespace and semicolons, normalises and de-duplicates', () => {
    expect(parseSymbolList(' aapl, GOOG;meta\nAAPL  tsla ')).toEqual({
      symbols: ['AAPL', 'GOOG', 'META', 'TSLA'],
      invalid: [],
    });
  });

  it('keeps class separators such as BRK.A and BRK-A', () => {
    expect(parseSymbolList('brk.a brk-a').symbols).toEqual(['BRK.A', 'BRK-A']);
  });

  it('reports tokens that cannot be symbols, as typed', () => {
    expect(parseSymbolList('AAPL, Inc!, 12345678901, goog, inc!')).toEqual({
      symbols: ['AAPL', 'GOOG'],
      invalid: ['Inc!', '12345678901', 'inc!'],
    });
  });

  it('is empty for blank input', () => {
    expect(parseSymbolList('  \n ')).toEqual({ symbols: [], invalid: [] });
  });
});

describe('toggleSymbolInText', () => {
  it('appends a missing symbol and rewrites the text tidily', () => {
    expect(toggleSymbolInText('aapl  goog', 'tsla')).toBe('AAPL, GOOG, TSLA');
  });

  it('removes a present symbol', () => {
    expect(toggleSymbolInText('AAPL, GOOG, TSLA', 'goog')).toBe('AAPL, TSLA');
  });
});

describe('validateWatchlistDraft', () => {
  it('passes a good draft', () => {
    const errors = validateWatchlistDraft({ name: ' Growth ', symbolsText: 'nflx, rblx' }, existing);
    expect(errors).toEqual({});
    expect(isDraftValid(errors)).toBe(true);
  });

  it('requires a name', () => {
    expect(validateWatchlistDraft({ name: '  ', symbolsText: 'AAPL' }, existing).name).toMatch(/name/i);
  });

  it('caps the name length', () => {
    expect(validateWatchlistDraft({ name: 'x'.repeat(41), symbolsText: 'AAPL' }, existing).name).toMatch(/40/);
  });

  it('rejects a name already in use, case-insensitively', () => {
    expect(validateWatchlistDraft({ name: 'tech', symbolsText: 'AAPL' }, existing).name).toMatch(/already/);
  });

  it('requires at least one symbol', () => {
    expect(validateWatchlistDraft({ name: 'New', symbolsText: ' , ' }, existing).symbols).toMatch(/at least one/);
  });

  it('names the invalid tokens', () => {
    expect(validateWatchlistDraft({ name: 'New', symbolsText: 'AAPL, bad!' }, existing).symbols).toBe(
      'Not a valid symbol: bad!.',
    );
  });

  it('caps the number of symbols', () => {
    const many = Array.from({ length: 21 }, (_, i) => `S${i}`).join(' ');
    expect(validateWatchlistDraft({ name: 'New', symbolsText: many }, existing).symbols).toMatch(/at most 20/);
  });
});

describe('prepareNewWatchlist', () => {
  it('turns a valid draft into trimmed, normalised content for the provider', () => {
    expect(prepareNewWatchlist({ name: '  Growth ', symbolsText: 'nflx, rblx, nflx' }, existing)).toEqual({
      name: 'Growth',
      symbols: ['NFLX', 'RBLX'],
    });
  });

  it('throws InvalidWatchlistError carrying the field errors', () => {
    expect.assertions(2);
    try {
      prepareNewWatchlist({ name: '', symbolsText: '' }, existing);
    } catch (err) {
      expect(err).toBeInstanceOf(InvalidWatchlistError);
      expect((err as InvalidWatchlistError).errors).toEqual({
        name: 'Give the watchlist a name.',
        symbols: 'Add at least one symbol.',
      });
    }
  });
});

describe('addWatchlist / removeWatchlist / replaceWatchlist', () => {
  const added: Watchlist = { id: 'new-id', name: 'New', symbols: ['V'] };

  it('adds newest first without mutating the input', () => {
    const next = addWatchlist(existing, added);
    expect(next.map((l) => l.name)).toEqual(['New', 'Tech']);
    expect(existing).toHaveLength(1);
  });

  it('removes by id', () => {
    expect(removeWatchlist([added, ...existing], '1')).toEqual([added]);
    expect(removeWatchlist(existing, 'nope')).toEqual(existing);
  });

  it('replaces name and symbols in place, leaving other lists and unknown ids alone', () => {
    const next = replaceWatchlist([added, ...existing], '1', { name: 'Tech 2', symbols: ['GOOG', 'AAPL'] });
    expect(next).toEqual([added, { id: '1', name: 'Tech 2', symbols: ['GOOG', 'AAPL'] }]);
    expect(replaceWatchlist(existing, 'nope', { name: 'x', symbols: ['A'] })).toEqual(existing);
  });
});

describe('validateWatchlistName', () => {
  it("lets a list keep its own name but not take another's", () => {
    expect(validateWatchlistName('TECH', existing, '1')).toBeUndefined();
    expect(validateWatchlistName('TECH', existing)).toMatch(/already/);
    expect(validateWatchlistName('TECH', existing, 'someone-else')).toMatch(/already/);
  });
});

describe('moveSymbol', () => {
  const abc = ['A', 'B', 'C'];

  it('moves an item up or down without mutating the input', () => {
    expect(moveSymbol(abc, 2, 0)).toEqual(['C', 'A', 'B']);
    expect(moveSymbol(abc, 0, 2)).toEqual(['B', 'C', 'A']);
    expect(moveSymbol(abc, 0, 1)).toEqual(['B', 'A', 'C']);
    expect(abc).toEqual(['A', 'B', 'C']);
  });

  it('returns a copy for a no-op or out-of-range move', () => {
    expect(moveSymbol(abc, 1, 1)).toEqual(abc);
    expect(moveSymbol(abc, -1, 0)).toEqual(abc);
    expect(moveSymbol(abc, 0, 3)).toEqual(abc);
  });
});

describe('removeSymbolAt', () => {
  it('drops the item at the index without mutating the input', () => {
    const abc = ['A', 'B', 'C'];
    expect(removeSymbolAt(abc, 1)).toEqual(['A', 'C']);
    expect(removeSymbolAt(abc, 5)).toEqual(abc);
    expect(abc).toEqual(['A', 'B', 'C']);
  });
});

describe('appendSymbols', () => {
  it('adds normalised symbols not already present, keeping order, without mutating the input', () => {
    const ab = ['A', 'B'];
    expect(appendSymbols(ab, ['c', 'A', 'd', 'c'])).toEqual(['A', 'B', 'C', 'D']);
    expect(appendSymbols(ab, [])).toEqual(ab);
    expect(ab).toEqual(['A', 'B']);
  });
});

describe('validateSymbols', () => {
  it('accepts a non-empty unique list within the limit', () => {
    expect(validateSymbols(['AAPL', 'BRK.A'])).toBeUndefined();
  });

  it('names each problem', () => {
    expect(validateSymbols([])).toMatch(/at least one/);
    expect(validateSymbols(['AAPL', 'bad!'])).toBe('Not a valid symbol: bad!.');
    expect(validateSymbols(['AAPL', 'AAPL'])).toMatch(/only once/);
    expect(validateSymbols(Array.from({ length: 21 }, (_, i) => `S${i}`))).toMatch(/at most 20 .*you have 21/);
  });
});

describe('validateWatchlistEdit / isEditUnchanged / prepareWatchlistEdit', () => {
  const tech: Watchlist = { id: '1', name: 'Tech', symbols: ['AAPL', 'GOOG'] };
  const other: Watchlist = { id: '2', name: 'Other', symbols: ['V'] };
  const lists = [tech, other];

  it('accepts a rename, a reordering, a removal and an addition', () => {
    expect(validateWatchlistEdit(tech, { name: ' Big tech ', symbols: ['GOOG', 'AAPL'] }, lists)).toEqual({});
    expect(validateWatchlistEdit(tech, { name: 'Tech', symbols: ['GOOG'] }, lists)).toEqual({});
    expect(validateWatchlistEdit(tech, { name: 'Tech', symbols: ['V', 'AAPL', 'GOOG', 'META'] }, lists)).toEqual({});
  });

  it('rejects a taken name and a symbol list that breaks the symbol rules', () => {
    const symbolsError = (symbols: string[]) => validateWatchlistEdit(tech, { name: 'Tech', symbols }, lists).symbols;
    expect(validateWatchlistEdit(tech, { name: 'other', symbols: tech.symbols }, lists).name).toMatch(/already/);
    expect(symbolsError([])).toMatch(/at least one/);
    expect(symbolsError(['AAPL', 'bad!'])).toMatch(/Not a valid symbol/);
    expect(symbolsError(['AAPL', 'AAPL'])).toMatch(/only once/);
  });

  it('detects an unchanged edit (name compared trimmed)', () => {
    expect(isEditUnchanged(tech, { name: ' Tech ', symbols: ['AAPL', 'GOOG'] })).toBe(true);
    expect(isEditUnchanged(tech, { name: 'Tech', symbols: ['GOOG', 'AAPL'] })).toBe(false);
    expect(isEditUnchanged(tech, { name: 'Tec', symbols: ['AAPL', 'GOOG'] })).toBe(false);
  });

  it('prepareWatchlistEdit returns the trimmed edit for the provider', () => {
    expect(prepareWatchlistEdit(tech, { name: ' Big tech ', symbols: ['GOOG', 'AAPL'] }, lists)).toEqual({
      name: 'Big tech',
      symbols: ['GOOG', 'AAPL'],
    });
  });

  it('prepareWatchlistEdit throws for an invalid edit', () => {
    expect(() => prepareWatchlistEdit(tech, { name: '', symbols: tech.symbols }, lists)).toThrow(InvalidWatchlistError);
    expect(() => prepareWatchlistEdit(tech, { name: 'Tech', symbols: [] }, lists)).toThrow(InvalidWatchlistError);
  });
});
