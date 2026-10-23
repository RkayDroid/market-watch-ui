/** Direction of an hourly price move relative to the previous hour. */
export type Trend = 'up' | 'down' | 'neutral';

/** Where price data is sourced from. */
export type DataSource = 'api' | 'file';

export const DATA_SOURCES: readonly DataSource[] = ['api', 'file'];

export function isDataSource(value: string): value is DataSource {
  return (DATA_SOURCES as readonly string[]).includes(value);
}

/** A single observed price for a symbol at a point in time. */
export interface PriceRecord {
  /** ISO-8601 timestamp. */
  date: string;
  rate: number;
}

/** Price records keyed by (upper-cased) ticker symbol. */
export type PriceTable = Record<string, PriceRecord[]>;

/** One row of the hourly breakdown shown in the UI. */
export interface HourlyPrice {
  hour: string;
  price: number;
  trend: Trend;
}

/** Fully derived view model for a stock lookup. */
export interface StockData {
  symbol: string;
  currentPrice: number;
  highPrice: number;
  lowPrice: number;
  changePercent: number;
  history: HourlyPrice[];
}
