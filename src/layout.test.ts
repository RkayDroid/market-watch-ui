import { describe, expect, it } from 'vitest';
import { LAYOUT } from './layout.ts';

const pct = (v: string) => Number(v.replace('%', ''));

describe('LAYOUT', () => {
  it('matches the agreed proportions', () => {
    expect(LAYOUT.symbolInput).toBe('30%');
    expect(LAYOUT.overviewTiles).toBe('15%');
  });

  it('leaves room for the chart beside the tiles', () => {
    expect(pct(LAYOUT.overviewTiles)).toBeLessThan(100);
  });
});
