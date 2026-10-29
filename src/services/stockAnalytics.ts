import type { HighLow, PastPerformance, PriceRecord, PriceSeries, Trend, TrendPoint } from '../types/stock.ts';

/** Direction of `current` relative to `previous`. The first point has no previous → neutral. */
export function computeTrend(current: number, previous: number | undefined): Trend {
  if (previous === undefined || current === previous) return 'neutral';
  return current > previous ? 'up' : 'down';
}

/** Percentage change from `start` to `end`, rounded to 2 decimals. */
export function computeChangePercent(start: number, end: number): number {
  if (start === 0) return 0;
  return parseFloat((((end - start) / start) * 100).toFixed(2));
}

export interface LabelOptions {
  locale?: string | string[];
  timeZone?: string;
}

const BARE_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** True for a bare `YYYY-MM-DD` date (daily and coarser samples), false for a full timestamp. */
export function isBareDate(value: string): boolean {
  return BARE_DATE.test(value);
}

/** Formats a full ISO timestamp as e.g. "Oct 21, 03:00 PM" (locale dependent). */
export function formatHourLabel(isoDate: string, options: LabelOptions = {}): string {
  return new Date(isoDate).toLocaleTimeString(options.locale, {
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    day: 'numeric',
    timeZone: options.timeZone,
  });
}

/**
 * Formats a sample timestamp for display. Full timestamps become "Oct 21, 03:00 PM";
 * bare dates become "Oct 21, 2026" and are rendered as calendar dates (in UTC) so they
 * never shift by a day in western time zones.
 */
export function formatPointLabel(date: string, options: LabelOptions = {}): string {
  if (!isBareDate(date)) return formatHourLabel(date, options);
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString(options.locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export type LabelFormatter = (date: string) => string;

/**
 * Converts candles into chart/table points. The close is the plotted `price` and drives
 * the trend (close vs. previous close); open/high/low are carried along for the table.
 */
export function buildTrendPoints(
  records: readonly PriceRecord[],
  formatLabel: LabelFormatter = formatPointLabel,
): TrendPoint[] {
  return records.map((record, index) => ({
    label: formatLabel(record.date),
    open: record.open,
    high: record.high,
    low: record.low,
    price: record.close,
    trend: computeTrend(record.close, records[index - 1]?.close),
  }));
}

/**
 * The highest `high` and lowest `low` across a period's candles, each with the
 * timestamp of the candle it was traded in. On a tie the earliest candle wins.
 * Replaces the retired `/highlow` endpoint; `records` must not be empty.
 */
export function computeHighLow(records: readonly PriceRecord[]): HighLow {
  if (records.length === 0) throw new Error('Cannot compute high/low of an empty series.');
  let highest = records[0];
  let lowest = records[0];
  for (const record of records) {
    if (record.high > highest.high) highest = record;
    if (record.low < lowest.low) lowest = record;
  }
  return {
    high: { price: highest.high, occurredAt: highest.date },
    low: { price: lowest.low, occurredAt: lowest.date },
  };
}

/**
 * Turns a `/historic` series for one period into the {@link PastPerformance} view
 * model: closing prices as trend points, change over the period and the derived high/low.
 */
export function summarizePerformance(series: PriceSeries, formatLabel?: LabelFormatter): PastPerformance {
  if (series.records.length === 0) {
    throw new Error(`No price history available for ${series.symbol}.`);
  }
  const first = series.records[0].close;
  const last = series.records[series.records.length - 1].close;

  const performance: PastPerformance = {
    symbol: series.symbol,
    period: series.period,
    interval: series.interval,
    latestPrice: last,
    changePercent: computeChangePercent(first, last),
    points: buildTrendPoints(series.records, formatLabel),
    ...computeHighLow(series.records),
  };
  if (series.referenceDate !== undefined) performance.referenceDate = series.referenceDate;
  if (series.window !== undefined) performance.window = series.window;
  return performance;
}
