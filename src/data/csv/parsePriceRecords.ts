import { parseCsv, CsvParseError, type CsvRow } from './parseCsv.ts';
import type { PriceRecord, PriceTable } from '../../types/stock.ts';

/** Column names expected in local-data.csv. */
export const PRICE_CSV_COLUMNS = {
  symbol: 'symbol',
  date: 'date',
  rate: 'rate',
} as const;

export interface SymbolPriceRecord extends PriceRecord {
  symbol: string;
}

export function normalizeSymbol(raw: string): string {
  return raw.trim().toUpperCase();
}

/** Validates and converts a single header-keyed CSV row into a typed record. */
export function parsePriceRow(row: CsvRow): SymbolPriceRecord {
  const { line, values } = row;

  const symbol = normalizeSymbol(values[PRICE_CSV_COLUMNS.symbol] ?? '');
  if (!symbol) {
    throw new CsvParseError('symbol must not be empty', line);
  }

  const dateText = values[PRICE_CSV_COLUMNS.date] ?? '';
  const timestamp = Date.parse(dateText);
  if (Number.isNaN(timestamp)) {
    throw new CsvParseError(`invalid date "${dateText}"`, line);
  }

  const rateText = values[PRICE_CSV_COLUMNS.rate] ?? '';
  const rate = Number(rateText);
  if (rateText === '' || !Number.isFinite(rate)) {
    throw new CsvParseError(`invalid rate "${rateText}"`, line);
  }

  return { symbol, date: new Date(timestamp).toISOString(), rate };
}

/** Groups flat records by symbol, sorting each series chronologically. */
export function groupBySymbol(records: readonly SymbolPriceRecord[]): PriceTable {
  const table: PriceTable = {};
  for (const { symbol, date, rate } of records) {
    (table[symbol] ??= []).push({ date, rate });
  }
  for (const series of Object.values(table)) {
    series.sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
  }
  return table;
}

function assertRequiredColumns(headers: readonly string[]): void {
  const missing = Object.values(PRICE_CSV_COLUMNS).filter((c) => !headers.includes(c));
  if (missing.length > 0) {
    throw new CsvParseError(`missing required column(s): ${missing.join(', ')}`, 1);
  }
}

/**
 * Parses the full text of a price CSV (`symbol,date,rate`) into a {@link PriceTable}.
 * Throws {@link CsvParseError} on structural or value-level problems, identifying the line.
 */
export function parsePriceTable(csvText: string): PriceTable {
  const { headers, rows } = parseCsv(csvText);
  if (headers.length === 0) {
    return {};
  }
  assertRequiredColumns(headers);
  return groupBySymbol(rows.map(parsePriceRow));
}
