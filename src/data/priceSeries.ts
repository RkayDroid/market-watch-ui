import { isPerformancePeriod, type PerformancePeriod } from '../types/performance.ts';
import type { DateWindow, PriceRecord, PriceSeries } from '../types/stock.ts';
import { InvalidPayloadError, isRecord, optionalString, requiredDate, requiredNumber } from './payload.ts';

/* ---------------------------------------------------------------------------
 * Payload of `GET /stock/{symbol}/historic?period={PERIOD}`
 * (see public/data/historic-{SYMBOL}-{PERIOD}.json for live captures):
 *
 *   { "ticker": "AAPL", "symbol": "AAPL", "period": "WEEK", "interval": "1d",
 *     "referenceDate": "2026-10-28", "window": { "start": "2026-10-22", "end": "2026-10-28" },
 *     "count": 5,
 *     "data": [ { "datetime": "2026-10-22", "open": 344.94, "high": 348.36, "low": 342.28, "close": 348.22 }, … ] }
 *
 * With `&referenceDate={YYYY-MM-DD}` the window is keyed by that date instead
 * (see public/data/historic-{SYMBOL}-{PERIOD}-{1,2}.json):
 *
 *   { "ticker": "AAPL", "symbol": "AAPL", "period": "WEEK", "interval": "1d",
 *     "results": { "2025-10-10": { "window": { … }, "count": 5, "data": [ … ] } } }
 *
 * Each sample is an OHLC candle; the period's high and low are derived from them
 * (see `computeHighLow` in services/stockAnalytics.ts) — there is no separate endpoint.
 * `datetime` is a full timestamp with offset for DAY ("2026-10-28T09:30:00-04:00")
 * and a bare date for every other period. `count` is informational.
 * ------------------------------------------------------------------------- */

export const PRICE_SERIES_SUBJECT = 'price history';

export interface ExpectedPriceSeries {
  symbol?: string;
  period?: PerformancePeriod;
  /** The `referenceDate` that was requested; the response must carry that window. */
  referenceDate?: string;
}

const CANDLE_FIELDS = ['open', 'high', 'low', 'close'] as const;

function parseCandle(subject: string, point: unknown, index: number): PriceRecord {
  if (!isRecord(point)) throw new InvalidPayloadError(subject, `data[${index}] is not an object`);
  const at = (field: string) => `data[${index}].${field}`;

  const date = requiredDate(subject, point.datetime, at('datetime'));
  const [open, high, low, close] = CANDLE_FIELDS.map((field) => requiredNumber(subject, point[field], at(field)));
  if (low > high) throw new InvalidPayloadError(subject, `${at('low')} (${low}) exceeds ${at('high')} (${high})`);

  return { date, open, high, low, close };
}

function parseWindow(subject: string, value: unknown): DateWindow | undefined {
  if (value === undefined || value === null) return undefined;
  if (!isRecord(value)) throw new InvalidPayloadError(subject, '"window" is not an object');
  return {
    start: requiredDate(subject, value.start, 'window.start'),
    end: requiredDate(subject, value.end, 'window.end'),
  };
}

function parseRecords(subject: string, data: unknown): PriceRecord[] {
  if (!Array.isArray(data)) throw new InvalidPayloadError(subject, '"data" is not an array');
  if (data.length === 0) throw new InvalidPayloadError(subject, '"data" is empty');
  const records = data.map((point, i) => parseCandle(subject, point, i));
  records.sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
  return records;
}

/**
 * Locates the window to use: the top-level `data` of a plain response, or the entry of a
 * `results` map. When a reference date was requested its entry must exist; otherwise a
 * single-entry map is taken as is (the offline fixtures stand in for any date this way).
 */
function selectWindow(
  subject: string,
  payload: Record<string, unknown>,
  expectedReferenceDate: string | undefined,
): { source: Record<string, unknown>; referenceDate: string | undefined } {
  if (payload.results === undefined) {
    const referenceDate = optionalString(subject, payload.referenceDate, 'referenceDate');
    return { source: payload, referenceDate };
  }

  if (!isRecord(payload.results)) throw new InvalidPayloadError(subject, '"results" is not an object');
  const keys = Object.keys(payload.results);
  if (keys.length === 0) throw new InvalidPayloadError(subject, '"results" is empty');

  let key: string;
  if (expectedReferenceDate !== undefined) {
    if (!(expectedReferenceDate in payload.results)) {
      throw new InvalidPayloadError(subject, `"results" has no entry for ${expectedReferenceDate} (has ${keys.join(', ')})`);
    }
    key = expectedReferenceDate;
  } else if (keys.length === 1) {
    key = keys[0];
  } else {
    throw new InvalidPayloadError(subject, `"results" holds several windows (${keys.join(', ')}) and none was requested`);
  }

  const entry = payload.results[key];
  if (!isRecord(entry)) throw new InvalidPayloadError(subject, `results["${key}"] is not an object`);
  return { source: entry, referenceDate: key };
}

/**
 * Validates a raw `/historic` payload and maps it to a chronologically sorted
 * {@link PriceSeries}. The period must be one the selector knows; when `expected`
 * is given it must also match, so a mismatched response can't be shown as the wrong window.
 */
export function parsePriceSeries(payload: unknown, expected: ExpectedPriceSeries = {}): PriceSeries {
  const subject = PRICE_SERIES_SUBJECT;
  if (!isRecord(payload)) throw new InvalidPayloadError(subject, 'body is not an object');

  const symbol = (
    optionalString(subject, payload.ticker, 'ticker') ??
    optionalString(subject, payload.symbol, 'symbol') ??
    expected.symbol
  )?.toUpperCase();
  if (!symbol) throw new InvalidPayloadError(subject, '"ticker" is missing');
  if (expected.symbol && symbol !== expected.symbol) {
    throw new InvalidPayloadError(subject, `"ticker" is ${symbol}, expected ${expected.symbol}`);
  }

  const period = optionalString(subject, payload.period, 'period') ?? expected.period;
  if (!period) throw new InvalidPayloadError(subject, '"period" is missing');
  if (!isPerformancePeriod(period)) throw new InvalidPayloadError(subject, `"period" ${period} is not recognised`);
  if (expected.period && period !== expected.period) {
    throw new InvalidPayloadError(subject, `"period" is ${period}, expected ${expected.period}`);
  }

  const interval = optionalString(subject, payload.interval, 'interval') ?? '';

  const { source, referenceDate } = selectWindow(subject, payload, expected.referenceDate);
  if (expected.referenceDate && referenceDate !== undefined && referenceDate !== expected.referenceDate) {
    throw new InvalidPayloadError(subject, `"referenceDate" is ${referenceDate}, expected ${expected.referenceDate}`);
  }

  const series: PriceSeries = { symbol, period, interval, records: parseRecords(subject, source.data) };
  if (referenceDate !== undefined) series.referenceDate = referenceDate;
  const window = parseWindow(subject, source.window);
  if (window) series.window = window;
  return series;
}
