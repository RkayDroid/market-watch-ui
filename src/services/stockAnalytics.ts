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

/** Converts raw records into chart/table points with per-sample trend indicators. */
export function buildTrendPoints(
  records: readonly PriceRecord[],
  formatLabel: LabelFormatter = formatPointLabel,
): TrendPoint[] {
  return records.map((record, index) => ({
    label: formatLabel(record.date),
    price: record.rate,
    trend: computeTrend(record.rate, records[index - 1]?.rate),
  }));
}

/**
 * Combines the `/historic` series and the `/highlow` figures for one period into the
 * {@link PastPerformance} view model. Both are for the same symbol and period by
 * construction (the providers validate that against the request).
 */
export function summarizePerformance(
  series: PriceSeries,
  highLow: HighLow,
  formatLabel?: LabelFormatter,
): PastPerformance {
  if (series.records.length === 0) {
    throw new Error(`No price history available for ${series.symbol}.`);
  }
  const first = series.records[0].rate;
  const last = series.records[series.records.length - 1].rate;

  return {
    symbol: series.symbol,
    period: series.period,
    interval: series.interval,
    latestPrice: last,
    changePercent: computeChangePercent(first, last),
    points: buildTrendPoints(series.records, formatLabel),
    high: highLow.high,
    low: highLow.low,
  };
}
