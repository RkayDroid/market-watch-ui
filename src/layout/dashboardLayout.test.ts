import { describe, expect, it } from 'vitest';
import { DASHBOARD_COLUMNS, DASHBOARD_SPLIT, splitPercentages } from './dashboardLayout.ts';

describe('dashboard layout', () => {
  it('is 20 / 60 / 20 on one row at lg', () => {
    expect(splitPercentages('lg')).toEqual({ tiles: 20, chart: 60, table: 20 });
    expect(DASHBOARD_SPLIT.tiles.lg + DASHBOARD_SPLIT.chart.lg + DASHBOARD_SPLIT.table.lg).toBe(DASHBOARD_COLUMNS);
  });

  it('is 30 / 70 with a full-width table at md', () => {
    expect(splitPercentages('md')).toEqual({ tiles: 30, chart: 70, table: 100 });
  });

  it('stacks everything at xs', () => {
    expect(splitPercentages('xs')).toEqual({ tiles: 100, chart: 100, table: 100 });
  });
});
