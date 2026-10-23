/** Layout constants for the single-row stock dashboard (tiles | chart | table). */

/** Height of the dashboard row on md+ screens; panels scroll internally if needed. */
export const DASHBOARD_HEIGHT = 380;

/** Grid column count; the split below is expressed out of this total. */
export const DASHBOARD_COLUMNS = 10;

/**
 * Column spans (out of {@link DASHBOARD_COLUMNS}) per breakpoint.
 *  - lg+: tiles 20% | chart 60% | table 20% on one row
 *  - md : tiles 30% | chart 70%, table full-width beneath
 *  - xs : everything stacked
 */
export const DASHBOARD_SPLIT = {
  tiles: { xs: 10, md: 3, lg: 2 },
  chart: { xs: 10, md: 7, lg: 6 },
  table: { xs: 10, md: 10, lg: 2 },
} as const;

/** Max height of the table panel when the dashboard stacks on small screens. */
export const STACKED_TABLE_MAX_HEIGHT = 420;

export type Breakpoint = keyof typeof DASHBOARD_SPLIT.tiles;

/** Width of each panel as a percentage at a breakpoint. */
export function splitPercentages(bp: Breakpoint): Record<keyof typeof DASHBOARD_SPLIT, number> {
  return {
    tiles: (DASHBOARD_SPLIT.tiles[bp] / DASHBOARD_COLUMNS) * 100,
    chart: (DASHBOARD_SPLIT.chart[bp] / DASHBOARD_COLUMNS) * 100,
    table: (DASHBOARD_SPLIT.table[bp] / DASHBOARD_COLUMNS) * 100,
  };
}
