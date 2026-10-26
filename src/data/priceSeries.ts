import { isPerformancePeriod, type PerformancePeriod } from '../types/performance.ts';
import type { PriceRecord, PriceSeries } from '../types/stock.ts';
import { InvalidPayloadError, isRecord, optionalString, requiredDate, requiredNumber } from './payload.ts';

/* ---------------------------------------------------------------------------
 * Payload of `GET /stock/{symbol}/historic?period={PERIOD}`
 * (see json/history-{SYMBOL}-{PERIOD}.json for live captures):
 *
 *   { "ticker": "AAPL", "period": "WEEK", "interval": "1d", "count": 5, "cached": false,
 *     "data": [ { "datetime": "2026-10-19", "price": 342.94 }, … ] }
 *
 * `datetime` is a full timestamp with offset for DAY ("2026-10-22T09:30:00-04:00")
 * and a bare date for every other period. `count` and `cached` are informational.
 * ------------------------------------------------------------------------- */

export const PRICE_SERIES_SUBJECT = 'price history';

/**
 * Validates a raw `/historic` payload and maps it to a chronologically sorted
 * {@link PriceSeries}. The period must be one the selector knows; when `expected`
 * is given it must also match, so a mismatched response can't be shown as the wrong window.
 */
export function parsePriceSeries(payload: unknown, expected?: { symbol?: string; period?: PerformancePeriod }): PriceSeries {
  const subject = PRICE_SERIES_SUBJECT;
  if (!isRecord(payload)) throw new InvalidPayloadError(subject, 'body is not an object');

  const symbol = (
    optionalString(subject, payload.ticker, 'ticker') ??
    optionalString(subject, payload.symbol, 'symbol') ??
    expected?.symbol
  )?.toUpperCase();
  if (!symbol) throw new InvalidPayloadError(subject, '"ticker" is missing');
  if (expected?.symbol && symbol !== expected.symbol) {
    throw new InvalidPayloadError(subject, `"ticker" is ${symbol}, expected ${expected.symbol}`);
  }

  const period = optionalString(subject, payload.period, 'period') ?? expected?.period;
  if (!period) throw new InvalidPayloadError(subject, '"period" is missing');
  if (!isPerformancePeriod(period)) throw new InvalidPayloadError(subject, `"period" ${period} is not recognised`);
  if (expected?.period && period !== expected.period) {
    throw new InvalidPayloadError(subject, `"period" is ${period}, expected ${expected.period}`);
  }

  const interval = optionalString(subject, payload.interval, 'interval') ?? '';

  if (!Array.isArray(payload.data)) throw new InvalidPayloadError(subject, '"data" is not an array');
  if (payload.data.length === 0) throw new InvalidPayloadError(subject, '"data" is empty');

  const records = payload.data.map((point, i): PriceRecord => {
    if (!isRecord(point)) throw new InvalidPayloadError(subject, `data[${i}] is not an object`);
    return {
      date: requiredDate(subject, point.datetime, `data[${i}].datetime`),
      rate: requiredNumber(subject, point.price, `data[${i}].price`),
    };
  });
  records.sort((a, b) => Date.parse(a.date) - Date.parse(b.date));

  return { symbol, period, interval, records };
}
