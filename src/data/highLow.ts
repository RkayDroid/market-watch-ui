import { isPerformancePeriod, type PerformancePeriod } from '../types/performance.ts';
import type { HighLow } from '../types/stock.ts';
import { InvalidPayloadError, isRecord, optionalString, requiredDate, requiredNumber } from './payload.ts';

/* ---------------------------------------------------------------------------
 * Payload of `GET /stock/{symbol}/highlow?period={PERIOD}`
 * (see json/highlow-{SYMBOL}-{PERIOD}.json for live captures):
 *
 *   { "symbol": "AAPL", "period": "WEEK",
 *     "high": 351.73, "highOccured": "2026-10-23T09:30:00-04:00",
 *     "low": 338.7,   "lowOccured":  "2026-10-20T09:30:00-04:00" }
 *
 * (The API spells it "Occured".) Timestamps are full for DAY/WEEK and bare dates otherwise.
 * ------------------------------------------------------------------------- */

export const HIGH_LOW_SUBJECT = 'high/low';

/** Validates a raw `/highlow` payload and maps it to {@link HighLow}. */
export function parseHighLow(payload: unknown, expected?: { symbol?: string; period?: PerformancePeriod }): HighLow {
  const subject = HIGH_LOW_SUBJECT;
  if (!isRecord(payload)) throw new InvalidPayloadError(subject, 'body is not an object');

  const symbol = (
    optionalString(subject, payload.symbol, 'symbol') ??
    optionalString(subject, payload.ticker, 'ticker') ??
    expected?.symbol
  )?.toUpperCase();
  if (!symbol) throw new InvalidPayloadError(subject, '"symbol" is missing');
  if (expected?.symbol && symbol !== expected.symbol) {
    throw new InvalidPayloadError(subject, `"symbol" is ${symbol}, expected ${expected.symbol}`);
  }

  const period = optionalString(subject, payload.period, 'period') ?? expected?.period;
  if (!period) throw new InvalidPayloadError(subject, '"period" is missing');
  if (!isPerformancePeriod(period)) throw new InvalidPayloadError(subject, `"period" ${period} is not recognised`);
  if (expected?.period && period !== expected.period) {
    throw new InvalidPayloadError(subject, `"period" is ${period}, expected ${expected.period}`);
  }

  const high = requiredNumber(subject, payload.high, 'high');
  const low = requiredNumber(subject, payload.low, 'low');
  if (low > high) throw new InvalidPayloadError(subject, `"low" (${low}) exceeds "high" (${high})`);

  return {
    symbol,
    period,
    high: { price: high, occurredAt: requiredDate(subject, payload.highOccured, 'highOccured') },
    low: { price: low, occurredAt: requiredDate(subject, payload.lowOccured, 'lowOccured') },
  };
}
