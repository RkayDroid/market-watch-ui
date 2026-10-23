/** SVG path-string builders. Pure. */

export interface XY {
  x: number;
  y: number;
}

const fmt = (n: number) => parseFloat(n.toFixed(2)).toString();

/** `M x0 y0 L x1 y1 …` for a polyline; empty string for no points. */
export function buildLinePath(points: readonly XY[]): string {
  if (points.length === 0) return '';
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${fmt(p.x)} ${fmt(p.y)}`).join(' ');
}

/** The line path closed down to `baselineY`, for a filled area beneath the line. */
export function buildAreaPath(points: readonly XY[], baselineY: number): string {
  if (points.length === 0) return '';
  const first = points[0];
  const last = points[points.length - 1];
  return `${buildLinePath(points)} L${fmt(last.x)} ${fmt(baselineY)} L${fmt(first.x)} ${fmt(baselineY)} Z`;
}
