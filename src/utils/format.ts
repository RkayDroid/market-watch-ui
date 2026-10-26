/**
 * Pure display formatters for stock detail fields. All output is English
 * (`en-US`) to match the rest of the UI and stay deterministic in tests.
 */

const LOCALE = 'en-US';
export const DEFAULT_CURRENCY = 'USD';

/**
 * Formats a price in the given ISO-4217 currency, e.g. `(347.725, 'USD') → "$347.73"`.
 * Well-formed but unknown codes render as `"XYZ 347.73"` (Intl's own fallback);
 * malformed codes, which would make Intl throw, render as `"347.73 <code>"`.
 */
export function formatPrice(value: number, currency: string = DEFAULT_CURRENCY): string {
  try {
    return new Intl.NumberFormat(LOCALE, { style: 'currency', currency }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

/** Friendly names for the exchange codes the API is known to return. */
export const EXCHANGE_NAMES: Readonly<Record<string, string>> = {
  NMS: 'NASDAQ Global Select Market',
  NGM: 'NASDAQ Global Market',
  NCM: 'NASDAQ Capital Market',
  NYQ: 'New York Stock Exchange',
  ASE: 'NYSE American',
  PCX: 'NYSE Arca',
};

/** Full exchange name for a code such as "NMS", or `undefined` when unknown. */
export function describeExchange(code: string): string | undefined {
  return EXCHANGE_NAMES[code.toUpperCase()];
}

/**
 * Humanises a market identifier: `"us_market" → "US Market"`.
 * Short tokens (≤ 3 chars) are treated as region codes and upper-cased.
 */
export function formatMarket(market: string): string {
  return market
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((token) => (token.length <= 3 ? token.toUpperCase() : token[0].toUpperCase() + token.slice(1)))
    .join(' ');
}

function displayName(type: 'currency' | 'language', code: string): string | undefined {
  try {
    const name = new Intl.DisplayNames([LOCALE], { type, fallback: 'none' }).of(code);
    // Some engines echo the code back instead of honouring `fallback: 'none'`.
    return name && name !== code ? name : undefined;
  } catch {
    return undefined;
  }
}

/** `"USD" → "US Dollar"`, or `undefined` for unknown codes. */
export function describeCurrency(code: string): string | undefined {
  return displayName('currency', code.toUpperCase());
}

/** `"en-US" → "American English"`, or `undefined` for unknown tags. */
export function describeLanguage(tag: string): string | undefined {
  return displayName('language', tag);
}

const INTERVAL_UNITS: Readonly<Record<string, [singular: string, adverb: string]>> = {
  m: ['minute', 'every minute'],
  h: ['hour', 'hourly'],
  d: ['day', 'daily'],
  wk: ['week', 'weekly'],
  mo: ['month', 'monthly'],
  y: ['year', 'yearly'],
};

/**
 * Describes an API sampling interval: `"1h" → "hourly"`, `"1d" → "daily"`,
 * `"2wk" → "every 2 weeks"`, `"1mo" → "monthly"`. Unknown formats are returned as-is.
 */
export function describeInterval(interval: string): string {
  const match = /^(\d+)\s*(m|h|d|wk|mo|y)$/i.exec(interval.trim());
  if (!match) return interval;
  const count = Number(match[1]);
  const [singular, adverb] = INTERVAL_UNITS[match[2].toLowerCase()];
  return count === 1 ? adverb : `every ${count} ${singular}s`;
}
