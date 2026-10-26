import type { PerformancePeriod } from './performance.ts';

/** Direction of a price move relative to the previous sample. */
export type Trend = 'up' | 'down' | 'neutral';

/** Where stock data is sourced from: the live API, or the offline JSON fixtures under `public/data`. */
export type DataSource = 'api' | 'local';

export const DATA_SOURCES: readonly DataSource[] = ['api', 'local'];

export function isDataSource(value: string): value is DataSource {
  return (DATA_SOURCES as readonly string[]).includes(value);
}

/** A single observed price for a symbol at a point in time. */
export interface PriceRecord {
  /** ISO-8601 timestamp, or a bare `YYYY-MM-DD` date for daily and coarser samples. */
  date: string;
  rate: number;
}

/** Chronological price samples for one look-back period, as returned by `GET /stock/{symbol}/historic`. */
export interface PriceSeries {
  symbol: string;
  period: PerformancePeriod;
  /** Sampling interval reported by the API, e.g. "1h", "1d", "2wk", "1mo". */
  interval: string;
  /** Sorted oldest → newest. Never empty. */
  records: PriceRecord[];
}

/** A price together with the moment it was observed. */
export interface PriceExtreme {
  price: number;
  /** ISO-8601 timestamp or bare date, as given by the API. */
  occurredAt: string;
}

/** Highest and lowest price over a look-back period, as returned by `GET /stock/{symbol}/highlow`. */
export interface HighLow {
  symbol: string;
  period: PerformancePeriod;
  high: PriceExtreme;
  low: PriceExtreme;
}

/**
 * Reference data about a listed stock, as returned by `GET /stock/{symbol}`.
 * Only `symbol` is guaranteed; every other field is shown when present.
 */
export interface StockDetails {
  /** Upper-case ticker symbol, e.g. "AAPL". */
  symbol: string;
  /** Short marketing name, e.g. "Apple". */
  displayName?: string;
  /** Full legal name, e.g. "Apple Inc.". */
  longName?: string;
  /** Sector classification, e.g. "Technology". */
  sector?: string;
  /** Exchange code, e.g. "NMS". */
  exchange?: string;
  /** Market identifier, e.g. "us_market". */
  market?: string;
  /** ISO-4217 currency code the price is quoted in, e.g. "USD". */
  currency?: string;
  /** BCP-47 language tag of the listing, e.g. "en-US". */
  language?: string;
  /** Price for the full trading day, in `currency`. */
  fulldayPrice?: number;
}

/** One sampled point of a price series as shown in the chart and table. */
export interface TrendPoint {
  /** Formatted timestamp of the sample. */
  label: string;
  price: number;
  trend: Trend;
}

/** View model of the "Past Performance" section for one symbol and period. */
export interface PastPerformance {
  symbol: string;
  period: PerformancePeriod;
  interval: string;
  /** Most recent sample of the series. */
  latestPrice: number;
  /** Percentage change from the first to the last sample of the series. */
  changePercent: number;
  points: TrendPoint[];
  high: PriceExtreme;
  low: PriceExtreme;
}

/** View model for a stock lookup. */
export interface StockData {
  symbol: string;
  details: StockDetails;
}
