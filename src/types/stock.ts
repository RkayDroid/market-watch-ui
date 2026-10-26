/** Direction of an hourly price move relative to the previous hour. */
export type Trend = 'up' | 'down' | 'neutral';

/** Where stock data is sourced from: the live API, or the offline JSON fixtures under `public/data`. */
export type DataSource = 'api' | 'local';

export const DATA_SOURCES: readonly DataSource[] = ['api', 'local'];

export function isDataSource(value: string): value is DataSource {
  return (DATA_SOURCES as readonly string[]).includes(value);
}

/** A single observed price for a symbol at a point in time. */
export interface PriceRecord {
  /** ISO-8601 timestamp. */
  date: string;
  rate: number;
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

/** One row of the hourly breakdown shown in the UI. */
export interface HourlyPrice {
  hour: string;
  price: number;
  trend: Trend;
}

/** Everything derived from a chronological hourly price series. */
export interface PriceHistory {
  currentPrice: number;
  highPrice: number;
  lowPrice: number;
  changePercent: number;
  hourly: HourlyPrice[];
}

/** Fully derived view model for a stock lookup. */
export interface StockData {
  symbol: string;
  details: StockDetails;
  /**
   * `null` when the data source has no historic prices for the symbol.
   * Currently always `null`: no source provides history yet, so the chart and
   * table in the "Past Performance" section render empty.
   */
  history: PriceHistory | null;
}
