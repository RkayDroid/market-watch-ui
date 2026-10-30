/**
 * {@link QUICK_SYMBOLS}: well-known symbols offered as one-click "quick add" toggles when creating
 * a watchlist. Mirrors the symbols with offline fixtures so every suggestion can be looked up
 * without a live API (`quickLinks.test.ts` keeps the two lists in step).
 */

export interface QuickSymbol {
  symbol: string;
  /** Short company name shown beneath the symbol. */
  name: string;
}

export const QUICK_SYMBOLS: readonly QuickSymbol[] = [
  { symbol: 'AAPL', name: 'Apple' },
  { symbol: 'GOOG', name: 'Alphabet' },
  { symbol: 'META', name: 'Meta Platforms' },
  { symbol: 'NFLX', name: 'Netflix' },
  { symbol: 'TSLA', name: 'Tesla' },
  { symbol: 'RBLX', name: 'Roblox' },
  { symbol: 'BRK.A', name: 'Berkshire Hathaway' },
];
