import type { HourlyPrice, PriceRecord, StockData, Trend } from '../types/stock.ts';

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

export interface HourLabelOptions {
  locale?: string | string[];
  timeZone?: string;
}

/** Formats an ISO timestamp as e.g. "Oct 21, 03:00 PM" (locale dependent). */
export function formatHourLabel(isoDate: string, options: HourLabelOptions = {}): string {
  return new Date(isoDate).toLocaleTimeString(options.locale, {
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    day: 'numeric',
    timeZone: options.timeZone,
  });
}

export type HourLabelFormatter = (isoDate: string) => string;

/** Converts raw records into table rows with per-hour trend indicators. */
export function buildHourlyHistory(
  records: readonly PriceRecord[],
  formatLabel: HourLabelFormatter = formatHourLabel,
): HourlyPrice[] {
  return records.map((record, index) => ({
    hour: formatLabel(record.date),
    price: record.rate,
    trend: computeTrend(record.rate, records[index - 1]?.rate),
  }));
}

/** Derives the full {@link StockData} view model from a chronological price series. */
export function summarizeStock(
  symbol: string,
  records: readonly PriceRecord[],
  formatLabel?: HourLabelFormatter,
): StockData {
  if (records.length === 0) {
    throw new Error(`No price data available for ${symbol}.`);
  }

  const rates = records.map((r) => r.rate);
  const startPrice = rates[0];
  const endPrice = rates[rates.length - 1];

  return {
    symbol,
    currentPrice: endPrice,
    highPrice: Math.max(...rates),
    lowPrice: Math.min(...rates),
    changePercent: computeChangePercent(startPrice, endPrice),
    history: buildHourlyHistory(records, formatLabel),
  };
}
