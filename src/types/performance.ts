/**
 * Look-back window for the "Past Performance" section. Values mirror the period
 * identifiers used by the history API (see public/data/historic-{SYMBOL}-{PERIOD}.json).
 */
export type PerformancePeriod = 'DAY' | 'WEEK' | 'MONTH' | 'HALF_YEAR' | 'YEAR' | 'FIVE_YEAR';

export interface PerformancePeriodOption {
  value: PerformancePeriod;
  label: string;
}

/** Display order and labels of the period selector. */
export const PERFORMANCE_PERIODS: readonly PerformancePeriodOption[] = [
  { value: 'DAY', label: 'Day' },
  { value: 'WEEK', label: 'Week' },
  { value: 'MONTH', label: 'Month' },
  { value: 'HALF_YEAR', label: 'Six Months' },
  { value: 'YEAR', label: 'Year' },
  { value: 'FIVE_YEAR', label: '5 Years' },
];

export const DEFAULT_PERFORMANCE_PERIOD: PerformancePeriod = 'DAY';

export function isPerformancePeriod(value: string): value is PerformancePeriod {
  return PERFORMANCE_PERIODS.some((option) => option.value === value);
}

/** Human-readable label for a period, e.g. `'HALF_YEAR' → 'Six Months'`. */
export function performancePeriodLabel(period: PerformancePeriod): string {
  return PERFORMANCE_PERIODS.find((option) => option.value === period)!.label;
}
