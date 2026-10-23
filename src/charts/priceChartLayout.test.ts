import { describe, expect, it } from 'vitest';
import type { HourlyPrice } from '../types/stock.ts';
import { anchorFor, computeDirection, computePriceChartLayout, DEFAULT_MARGIN } from './priceChartLayout.ts';

const h = (price: number, hour = `h${price}`): HourlyPrice => ({ hour, price, trend: 'neutral' });

const options = { width: 200, height: 100, margin: { top: 10, right: 10, bottom: 10, left: 40 } };

describe('anchorFor', () => {
  it('anchors edge labels inward and everything else centred', () => {
    expect(anchorFor(0, 5)).toBe('start');
    expect(anchorFor(4, 5)).toBe('end');
    expect(anchorFor(2, 5)).toBe('middle');
    expect(anchorFor(0, 1)).toBe('middle');
  });
});

describe('computeDirection', () => {
  it('compares first and last price', () => {
    expect(computeDirection([h(1), h(5), h(3)])).toBe('up');
    expect(computeDirection([h(5), h(9), h(3)])).toBe('down');
    expect(computeDirection([h(5), h(5)])).toBe('flat');
    expect(computeDirection([h(5)])).toBe('flat');
    expect(computeDirection([])).toBe('flat');
  });
});

describe('computePriceChartLayout', () => {
  it('returns an empty layout with plot bounds for no data', () => {
    const layout = computePriceChartLayout([], options);
    expect(layout.points).toEqual([]);
    expect(layout.linePath).toBe('');
    expect(layout.areaPath).toBe('');
    expect(layout.plot).toEqual({ left: 40, right: 190, top: 10, bottom: 90 });
  });

  it('uses default margins when none given', () => {
    const layout = computePriceChartLayout([h(1)], { width: 800, height: 300 });
    expect(layout.margin).toEqual(DEFAULT_MARGIN);
    expect(layout.plot.right).toBe(800 - DEFAULT_MARGIN.right);
  });

  it('scales x across the plot width and y with min at bottom / max at top (after padding)', () => {
    // prices 100..200 → padded domain 90..210 → 120 units over 80px
    const layout = computePriceChartLayout([h(100), h(150), h(200)], options);

    expect(layout.points.map((p) => p.x)).toEqual([40, 115, 190]);
    expect(layout.points[0].y).toBeCloseTo(90 - (10 / 120) * 80); // 100 sits 10 above 90
    expect(layout.points[1].y).toBeCloseTo(50); // midpoint
    expect(layout.points[2].y).toBeCloseTo(10 + (10 / 120) * 80);
    expect(layout.direction).toBe('up');
  });

  it('carries through hour, price, trend and index for each point', () => {
    const layout = computePriceChartLayout([{ hour: '3pm', price: 1, trend: 'up' }], options);
    expect(layout.points[0]).toMatchObject({ index: 0, hour: '3pm', price: 1, trend: 'up' });
    // single point sits in the middle of the plot
    expect(layout.points[0].x).toBe(115);
  });

  it('produces y ticks inside the padded domain and x ticks from selected indices', () => {
    const history = Array.from({ length: 24 }, (_, i) => h(100 + i, `H${i}`));
    const layout = computePriceChartLayout(history, { ...options, maxXTicks: 3, yTickCount: 4 });

    expect(layout.xTicks.map((t) => t.label)).toEqual(['H0', 'H12', 'H23']);
    expect(layout.xTicks.map((t) => t.anchor)).toEqual(['start', 'middle', 'end']);
    expect(layout.xTicks[0].x).toBe(40);
    expect(layout.xTicks[2].x).toBe(190);

    expect(layout.yTicks.length).toBeGreaterThanOrEqual(3);
    for (const t of layout.yTicks) {
      expect(t.value).toBeGreaterThanOrEqual(100 - 2.3);
      expect(t.value).toBeLessThanOrEqual(123 + 2.3);
      expect(t.y).toBeGreaterThanOrEqual(10);
      expect(t.y).toBeLessThanOrEqual(90);
    }
  });

  it('builds line and area paths from the scaled points', () => {
    const layout = computePriceChartLayout([h(1), h(2)], options);
    expect(layout.linePath).toMatch(/^M40 [\d.]+ L190 [\d.]+$/);
    expect(layout.areaPath).toMatch(/ L190 90 L40 90 Z$/);
  });
});
