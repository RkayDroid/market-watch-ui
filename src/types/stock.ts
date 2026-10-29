import type { PerformancePeriod } from './performance.ts';

/** Direction of a price move relative to the previous sample. */
export type Trend = 'up' | 'down' | 'neutral';

/** Where stock data is sourced from: the live API, or the offline JSON fixtures under `public/data`. */
export type DataSource = 'api' | 'local';

export const DATA_SOURCES: readonly DataSource[] = ['api', 'local'];

export function isDataSource(value: string): value is DataSource {
  return (DATA_SOURCES as readonly string[]).includes(value);
}

/** One OHLC candle of a price series: the prices observed over a single sampling interval. */
export interface PriceRecord {
  /**
   * Start of the interval: an ISO-8601 timestamp for hourly samples, or a bare
   * `YYYY-MM-DD` date for daily and coarser samples.
   */
  date: string;
  open: number;
  /** Highest price traded during the interval. */
  high: number;
  /** Lowest price traded during the interval. */
  low: number;
  /** Last price of the interval — the "price" shown in the chart and table. */
  close: number;
}

/** First and last calendar date (`YYYY-MM-DD`) of a look-back window. */
export interface DateWindow {
  start: string;
  end: string;
}

/** Chronological price candles for one look-back period, as returned by `GET /stock/{symbol}/historic`. */
export interface PriceSeries {
  symbol: string;
  period: PerformancePeriod;
  /** Sampling interval reported by the API, e.g. "1h", "1d", "2wk", "1mo". */
  interval: string;
  /** Date (`YYYY-MM-DD`) the window is anchored on, as reported by the API (today when none was requested). */
  referenceDate?: string;
  /** Calendar span the candles cover, when the API reports it. */
  window?: DateWindow;
  /** Sorted oldest → newest. Never empty. */
  records: PriceRecord[];
}

/** A price together with the moment it was observed. */
export interface PriceExtreme {
  price: number;
  /** ISO-8601 timestamp or bare date of the candle the price was observed in. */
  occurredAt: string;
}

/**
 * Highest and lowest price over a look-back period. Derived from the candles of a
 * {@link PriceSeries} (`computeHighLow`); the API no longer serves it separately.
 */
export interface HighLow {
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

/** One candle of a price series as shown in the chart and table. */
export interface TrendPoint {
  /** Formatted timestamp of the candle. */
  label: string;
  open: number;
  high: number;
  low: number;
  /** Closing price — the value the chart plots and the trend is computed on. */
  price: number;
  /** Direction of the close relative to the previous candle's close. */
  trend: Trend;
}

/** View model of the "Past Performance" section for one symbol and period. */
export interface PastPerformance {
  symbol: string;
  period: PerformancePeriod;
  interval: string;
  /** Date the window is anchored on, as served (see {@link PriceSeries.referenceDate}). */
  referenceDate?: string;
  window?: DateWindow;
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
