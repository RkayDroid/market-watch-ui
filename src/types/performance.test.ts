import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PERFORMANCE_PERIOD,
  isPerformancePeriod,
  PERFORMANCE_PERIODS,
  performancePeriodLabel,
} from './performance.ts';

describe('performance periods', () => {
  it('offers Day / Week / Month / Six Months / Year / 5 Years, in that order', () => {
    expect(PERFORMANCE_PERIODS.map((p) => p.label)).toEqual(['Day', 'Week', 'Month', 'Six Months', 'Year', '5 Years']);
    expect(PERFORMANCE_PERIODS.map((p) => p.value)).toEqual(['DAY', 'WEEK', 'MONTH', 'HALF_YEAR', 'YEAR', 'FIVE_YEAR']);
  });

  it('defaults to Day', () => {
    expect(DEFAULT_PERFORMANCE_PERIOD).toBe('DAY');
    expect(isPerformancePeriod(DEFAULT_PERFORMANCE_PERIOD)).toBe(true);
  });

  it('recognises only the API period identifiers', () => {
    expect(isPerformancePeriod('FIVE_YEAR')).toBe(true);
    expect(isPerformancePeriod('5 Years')).toBe(false);
    expect(isPerformancePeriod('day')).toBe(false);
  });

  it('labels a period', () => {
    expect(performancePeriodLabel('HALF_YEAR')).toBe('Six Months');
    expect(performancePeriodLabel('DAY')).toBe('Day');
  });
});
