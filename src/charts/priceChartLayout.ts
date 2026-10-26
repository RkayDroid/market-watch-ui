import type { TrendPoint, Trend } from '../types/stock.ts';
import { buildAreaPath, buildLinePath } from './paths.ts';
import { createLinearScale, generateTicks, padDomain, selectTickIndices } from './scales.ts';

export interface ChartMargin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface PriceChartOptions {
  width: number;
  height: number;
  margin?: Partial<ChartMargin>;
  yTickCount?: number;
  maxXTicks?: number;
}

export interface ChartPoint {
  x: number;
  y: number;
  index: number;
  price: number;
  label: string;
  trend: Trend;
}

export interface YTick {
  value: number;
  y: number;
}

export type TextAnchor = 'start' | 'middle' | 'end';

export interface XTick {
  index: number;
  label: string;
  x: number;
  /** First/last labels anchor inward so they aren't clipped at the plot edges. */
  anchor: TextAnchor;
}

export interface PriceChartLayout {
  width: number;
  height: number;
  margin: ChartMargin;
  /** Pixel bounds of the plotting area. */
  plot: { left: number; right: number; top: number; bottom: number };
  points: ChartPoint[];
  yTicks: YTick[];
  xTicks: XTick[];
  linePath: string;
  areaPath: string;
  /** Overall direction from first to last point, drives the chart colour. */
  direction: 'up' | 'down' | 'flat';
}

export const DEFAULT_MARGIN: ChartMargin = { top: 16, right: 16, bottom: 36, left: 56 };

/** Edge labels anchor inward; a lone label is centred. */
export function anchorFor(index: number, count: number): TextAnchor {
  if (count <= 1) return 'middle';
  if (index === 0) return 'start';
  if (index === count - 1) return 'end';
  return 'middle';
}

export function computeDirection(history: readonly TrendPoint[]): PriceChartLayout['direction'] {
  if (history.length < 2) return 'flat';
  const first = history[0].price;
  const last = history[history.length - 1].price;
  if (last > first) return 'up';
  if (last < first) return 'down';
  return 'flat';
}

/**
 * Turns an hourly series into everything the SVG needs: scaled points, tick positions
 * and path strings. Pure; fully testable without a DOM.
 */
export function computePriceChartLayout(
  history: readonly TrendPoint[],
  options: PriceChartOptions,
): PriceChartLayout {
  const { width, height, yTickCount = 5, maxXTicks = 6 } = options;
  const margin: ChartMargin = { ...DEFAULT_MARGIN, ...options.margin };
  const plot = {
    left: margin.left,
    right: width - margin.right,
    top: margin.top,
    bottom: height - margin.bottom,
  };

  if (history.length === 0) {
    return {
      width,
      height,
      margin,
      plot,
      points: [],
      yTicks: [],
      xTicks: [],
      linePath: '',
      areaPath: '',
      direction: 'flat',
    };
  }

  const prices = history.map((h) => h.price);
  const [yMin, yMax] = padDomain(Math.min(...prices), Math.max(...prices));

  const xScale = createLinearScale([0, history.length - 1], [plot.left, plot.right]);
  const yScale = createLinearScale([yMin, yMax], [plot.bottom, plot.top]); // SVG y grows downward

  const points: ChartPoint[] = history.map((h, index) => ({
    x: xScale(index),
    y: yScale(h.price),
    index,
    price: h.price,
    label: h.label,
    trend: h.trend,
  }));

  const yTicks: YTick[] = generateTicks(yMin, yMax, yTickCount).map((value) => ({
    value,
    y: yScale(value),
  }));

  const xTicks: XTick[] = selectTickIndices(history.length, maxXTicks).map((index) => ({
    index,
    label: history[index].label,
    x: xScale(index),
    anchor: anchorFor(index, history.length),
  }));

  return {
    width,
    height,
    margin,
    plot,
    points,
    yTicks,
    xTicks,
    linePath: buildLinePath(points),
    areaPath: buildAreaPath(points, plot.bottom),
    direction: computeDirection(history),
  };
}
