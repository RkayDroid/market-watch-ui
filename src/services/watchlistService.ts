import {
  SYMBOL_PATTERN,
  WATCHLIST_MAX_SYMBOLS,
  WATCHLIST_NAME_MAX_LENGTH,
  type NewWatchlist,
  type Watchlist,
  type WatchlistDraft,
  type WatchlistEdit,
} from '../types/watchlist.ts';
import { normalizeSymbol } from '../utils/symbol.ts';

/**
 * Pure watchlist rules: how free text becomes a symbol list, what makes a draft or an edit
 * valid, and how the in-memory collection changes. No state, no I/O — the hook wires a
 * {@link WatchlistProvider} in, and providers receive only what passed these rules.
 */

export interface ParsedSymbolList {
  /** Accepted symbols, normalised, in first-seen order, without duplicates. */
  symbols: string[];
  /** Tokens (as typed, trimmed) that do not look like a ticker symbol. */
  invalid: string[];
}

/** Splits "aapl, msft brk.a" into `['AAPL', 'MSFT', 'BRK.A']`; separators are commas, whitespace and semicolons. */
export function parseSymbolList(text: string): ParsedSymbolList {
  const symbols: string[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();
  for (const token of text.split(/[\s,;]+/)) {
    const trimmed = token.trim();
    if (!trimmed) continue;
    const symbol = normalizeSymbol(trimmed);
    if (!SYMBOL_PATTERN.test(symbol)) {
      if (!invalid.includes(trimmed)) invalid.push(trimmed);
      continue;
    }
    if (seen.has(symbol)) continue;
    seen.add(symbol);
    symbols.push(symbol);
  }
  return { symbols, invalid };
}

/** Adds `symbol` to the text (or removes it when already present), keeping the text tidy. */
export function toggleSymbolInText(text: string, symbol: string): string {
  const { symbols } = parseSymbolList(text);
  const target = normalizeSymbol(symbol);
  const next = symbols.includes(target) ? symbols.filter((s) => s !== target) : [...symbols, target];
  return next.join(', ');
}

export interface WatchlistDraftErrors {
  name?: string;
  symbols?: string;
}

/**
 * Validation message for a watchlist name, or `undefined` when it is fine. `selfId` excludes the
 * list being edited from the uniqueness check so keeping its own name is allowed.
 */
export function validateWatchlistName(
  rawName: string,
  existing: readonly Watchlist[],
  selfId?: string,
): string | undefined {
  const name = rawName.trim();
  if (!name) return 'Give the watchlist a name.';
  if (name.length > WATCHLIST_NAME_MAX_LENGTH) return `Keep the name to ${WATCHLIST_NAME_MAX_LENGTH} characters.`;
  if (existing.some((list) => list.id !== selfId && list.name.toLowerCase() === name.toLowerCase())) {
    return `You already have a watchlist called "${name}".`;
  }
  return undefined;
}

/** Field-level validation messages for a draft; an empty object means the draft can be saved. */
export function validateWatchlistDraft(draft: WatchlistDraft, existing: readonly Watchlist[]): WatchlistDraftErrors {
  const errors: WatchlistDraftErrors = {};

  const nameError = validateWatchlistName(draft.name, existing);
  if (nameError) errors.name = nameError;

  const { symbols, invalid } = parseSymbolList(draft.symbolsText);
  if (invalid.length) errors.symbols = `Not a valid symbol: ${invalid.join(', ')}.`;
  else if (symbols.length === 0) errors.symbols = 'Add at least one symbol.';
  else if (symbols.length > WATCHLIST_MAX_SYMBOLS) {
    errors.symbols = `A watchlist holds at most ${WATCHLIST_MAX_SYMBOLS} symbols (you entered ${symbols.length}).`;
  }

  return errors;
}

export function isDraftValid(errors: WatchlistDraftErrors): boolean {
  return !errors.name && !errors.symbols;
}

export class InvalidWatchlistError extends Error {
  readonly errors: WatchlistDraftErrors;

  constructor(errors: WatchlistDraftErrors) {
    super([errors.name, errors.symbols].filter(Boolean).join(' '));
    this.name = 'InvalidWatchlistError';
    this.errors = errors;
  }
}

/** A valid draft as the content of a new list (trimmed, normalised); throws {@link InvalidWatchlistError} otherwise. */
export function prepareNewWatchlist(draft: WatchlistDraft, existing: readonly Watchlist[]): NewWatchlist {
  const errors = validateWatchlistDraft(draft, existing);
  if (!isDraftValid(errors)) throw new InvalidWatchlistError(errors);
  return { name: draft.name.trim(), symbols: parseSymbolList(draft.symbolsText).symbols };
}

/** Newest first. */
export function addWatchlist(lists: readonly Watchlist[], list: Watchlist): Watchlist[] {
  return [list, ...lists];
}

export function removeWatchlist(lists: readonly Watchlist[], id: string): Watchlist[] {
  return lists.filter((list) => list.id !== id);
}

/** The collection with `edit` applied to the list with `id`, in place (unknown ids leave it unchanged). */
export function replaceWatchlist(lists: readonly Watchlist[], id: string, edit: WatchlistEdit): Watchlist[] {
  return lists.map((list) => (list.id === id ? { ...list, name: edit.name, symbols: [...edit.symbols] } : list));
}

/** The list with the item at `from` moved to `to`; out-of-range indexes leave it unchanged. */
export function moveSymbol(symbols: readonly string[], from: number, to: number): string[] {
  if (from === to || from < 0 || to < 0 || from >= symbols.length || to >= symbols.length) return [...symbols];
  const next = [...symbols];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/** True when `edit` would leave `list` exactly as it is. */
export function isEditUnchanged(list: Watchlist, edit: WatchlistEdit): boolean {
  return (
    edit.name.trim() === list.name &&
    edit.symbols.length === list.symbols.length &&
    edit.symbols.every((symbol, i) => symbol === list.symbols[i])
  );
}

/** `symbols` without the item at `index`; out-of-range leaves it unchanged. */
export function removeSymbolAt(symbols: readonly string[], index: number): string[] {
  return symbols.filter((_, i) => i !== index);
}

/** `symbols` followed by those of `additions` not already present (normalised, first-seen order). */
export function appendSymbols(symbols: readonly string[], additions: readonly string[]): string[] {
  const next = [...symbols];
  for (const raw of additions) {
    const symbol = normalizeSymbol(raw);
    if (!next.includes(symbol)) next.push(symbol);
  }
  return next;
}

/** Validation message for a final symbol list (create or edit), or `undefined` when it is fine. */
export function validateSymbols(symbols: readonly string[]): string | undefined {
  if (symbols.length === 0) return 'Keep at least one symbol — delete the watchlist instead.';
  const invalid = symbols.filter((symbol) => !SYMBOL_PATTERN.test(symbol));
  if (invalid.length) return `Not a valid symbol: ${invalid.join(', ')}.`;
  if (new Set(symbols).size !== symbols.length) return 'Each symbol can appear only once.';
  if (symbols.length > WATCHLIST_MAX_SYMBOLS) {
    return `A watchlist holds at most ${WATCHLIST_MAX_SYMBOLS} symbols (you have ${symbols.length}).`;
  }
  return undefined;
}

/**
 * Field-level validation of an edit: the name rules (the list's own name stays allowed) and the
 * symbol rules — the edited list may add, remove and reorder symbols freely within them.
 */
export function validateWatchlistEdit(
  list: Watchlist,
  edit: WatchlistEdit,
  existing: readonly Watchlist[],
): WatchlistDraftErrors {
  const errors: WatchlistDraftErrors = {};
  const nameError = validateWatchlistName(edit.name, existing, list.id);
  if (nameError) errors.name = nameError;

  const symbolsError = validateSymbols(edit.symbols);
  if (symbolsError) errors.symbols = symbolsError;
  return errors;
}

/** A valid edit as the provider should receive it (name trimmed); throws {@link InvalidWatchlistError} otherwise. */
export function prepareWatchlistEdit(
  list: Watchlist,
  edit: WatchlistEdit,
  existing: readonly Watchlist[],
): WatchlistEdit {
  const errors = validateWatchlistEdit(list, edit, existing);
  if (!isDraftValid(errors)) throw new InvalidWatchlistError(errors);
  return { name: edit.name.trim(), symbols: [...edit.symbols] };
}
