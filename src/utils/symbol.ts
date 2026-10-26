/** Canonical form of a user-typed ticker symbol: trimmed and upper-cased. */
export function normalizeSymbol(raw: string): string {
  return raw.trim().toUpperCase();
}
