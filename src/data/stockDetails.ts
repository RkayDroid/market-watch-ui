import type { StockDetails } from '../types/stock.ts';
import { InvalidPayloadError, isRecord, optionalNumber, optionalString } from './payload.ts';

/* ---------------------------------------------------------------------------
 * Payload of `GET /stock/{symbol}` (see public/data/detail-*.json for live captures):
 *
 *   { "ticker": "AAPL", "symbol": "AAPL", "displayName": "Apple",
 *     "longName": "Apple Inc.", "sector": "Technology", "exchange": "NMS",
 *     "market": "us_market", "currency": "USD", "language": "en-US",
 *     "fulldayPrice": 343.83 }
 *
 * `ticker` is the identifier the API was asked for and accepts on the other
 * endpoints; `symbol` is the provider's own spelling, which can differ
 * (BRK.A → "BRK-A"). The model's `symbol` is therefore taken from `ticker` first.
 *
 * The same shape is served from public/data/detail-{SYMBOL}.json for the
 * offline source, so both providers share this parser.
 * ------------------------------------------------------------------------- */

export const STOCK_DETAILS_SUBJECT = 'stock details';

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

/**
 * Validates a raw `/stock/{symbol}` payload and maps it to {@link StockDetails}.
 * `symbol` is taken from `ticker`, falling back to `symbol` (the payload carries
 * both), and is upper-cased. Throws {@link InvalidPayloadError} for anything off-contract.
 */
export function parseStockDetails(payload: unknown): StockDetails {
  const subject = STOCK_DETAILS_SUBJECT;
  if (!isRecord(payload)) throw new InvalidPayloadError(subject, 'body is not an object');

  const symbol =
    optionalString(subject, payload.ticker, 'ticker') ?? optionalString(subject, payload.symbol, 'symbol');
  if (!symbol) throw new InvalidPayloadError(subject, '"symbol" is missing');

  const details: StockDetails = { symbol: symbol.toUpperCase() };

  for (const field of OPTIONAL_STRING_FIELDS) {
    const value = optionalString(subject, payload[field], field);
    if (value !== undefined) details[field] = value;
  }

  const fulldayPrice = optionalNumber(subject, payload.fulldayPrice, 'fulldayPrice');
  if (fulldayPrice !== undefined) details.fulldayPrice = fulldayPrice;

  return details;
}
