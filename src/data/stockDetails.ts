import type { StockDetails } from '../types/stock.ts';

/* ---------------------------------------------------------------------------
 * Payload of `GET /stock/{symbol}` (see json/detail-*.json for live captures):
 *
 *   { "ticker": "AAPL", "symbol": "AAPL", "displayName": "Apple",
 *     "longName": "Apple Inc.", "sector": "Technology", "exchange": "NMS",
 *     "market": "us_market", "currency": "USD", "language": "en-US",
 *     "fulldayPrice": 347.725 }
 *
 * The same shape is served from public/data/detail-{SYMBOL}.json for the
 * offline (local file) source, so both providers share this parser.
 * ------------------------------------------------------------------------- */

/** Thrown when a details payload is off-contract. Providers wrap it in their own error type. */
export class InvalidStockDetailsError extends Error {
  readonly reason: string;

  constructor(reason: string) {
    super(`Invalid stock details: ${reason}.`);
    this.name = 'InvalidStockDetailsError';
    this.reason = reason;
  }
}

type OptionalStringKey = Exclude<keyof StockDetails, 'symbol' | 'fulldayPrice'>;

const OPTIONAL_STRING_FIELDS: readonly OptionalStringKey[] = [
  'displayName',
  'longName',
  'sector',
  'exchange',
  'market',
  'currency',
  'language',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Accepts a non-blank string; `null`/`undefined` mean "not provided"; anything else is invalid. */
function optionalString(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') throw new InvalidStockDetailsError(`"${field}" is not a string`);
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

/** Accepts a finite number or numeric string; `null`/`undefined` mean "not provided". */
function optionalNumber(value: unknown, field: string): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const num = typeof value === 'number' ? value : Number(value);
  if (typeof value === 'boolean' || !Number.isFinite(num)) {
    throw new InvalidStockDetailsError(`"${field}" is not a number`);
  }
  return num;
}

/**
 * Validates a raw `/stock/{symbol}` payload and maps it to {@link StockDetails}.
 * `symbol` falls back to `ticker` (the payload carries both) and is upper-cased.
 * Throws {@link InvalidStockDetailsError} for anything off-contract.
 */
export function parseStockDetails(payload: unknown): StockDetails {
  if (!isRecord(payload)) throw new InvalidStockDetailsError('body is not an object');

  const symbol = optionalString(payload.symbol, 'symbol') ?? optionalString(payload.ticker, 'ticker');
  if (!symbol) throw new InvalidStockDetailsError('"symbol" is missing');

  const details: StockDetails = { symbol: symbol.toUpperCase() };

  for (const field of OPTIONAL_STRING_FIELDS) {
    const value = optionalString(payload[field], field);
    if (value !== undefined) details[field] = value;
  }

  const fulldayPrice = optionalNumber(payload.fulldayPrice, 'fulldayPrice');
  if (fulldayPrice !== undefined) details.fulldayPrice = fulldayPrice;

  return details;
}
