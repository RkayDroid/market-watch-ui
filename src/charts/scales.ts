/**
 * Pure numeric helpers for laying out a 2-D chart. No DOM, no React.
 */

export type Scale = (value: number) => number;

/** Maps `[d0, d1]` linearly onto `[r0, r1]`. A degenerate domain maps everything to the range midpoint. */
export function createLinearScale([d0, d1]: [number, number], [r0, r1]: [number, number]): Scale {
  const span = d1 - d0;
  if (span === 0) {
    const mid = (r0 + r1) / 2;
    return () => mid;
  }
  return (value) => r0 + ((value - d0) / span) * (r1 - r0);
}

/**
 * Expands `[min, max]` by `paddingRatio` on each side so the line doesn't touch the edges.
 * A flat series (min === max) is padded by 1% of the value (or ±1 if the value is 0).
 */
export function padDomain(min: number, max: number, paddingRatio = 0.1): [number, number] {
  if (min === max) {
    const pad = min === 0 ? 1 : Math.abs(min) * 0.01;
    return [min - pad, max + pad];
  }
  const pad = (max - min) * paddingRatio;
  return [min - pad, max + pad];
}

/** Rounds `step` to 1, 2 or 5 × 10^n so tick values look natural. */
export function niceStep(rawStep: number): number {
  if (rawStep <= 0 || !Number.isFinite(rawStep)) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const residual = rawStep / magnitude;
  const factor = residual <= 1 ? 1 : residual <= 2 ? 2 : residual <= 5 ? 5 : 10;
  return factor * magnitude;
}

/** Evenly spaced "nice" tick values covering `[min, max]`, roughly `count` of them. */
export function generateTicks(min: number, max: number, count = 5): number[] {
  if (count < 1 || min > max) return [];
  if (min === max) return [min];

  const step = niceStep((max - min) / count);
  const start = Math.ceil(min / step) * step;
  const ticks: number[] = [];
  // guard against floating-point drift with a small epsilon
  for (let v = start; v <= max + step * 1e-9; v += step) {
    ticks.push(parseFloat(v.toFixed(10)));
  }
  return ticks;
}

/** Indices of `count` items to label on a categorical axis, always including first and last. */
export function selectTickIndices(count: number, maxTicks: number): number[] {
  if (count <= 0 || maxTicks <= 0) return [];
  if (count === 1 || maxTicks === 1) return [0];
  if (count <= maxTicks) return Array.from({ length: count }, (_, i) => i);

  const step = (count - 1) / (maxTicks - 1);
  const indices = new Set<number>();
  for (let i = 0; i < maxTicks; i++) {
    indices.add(Math.round(i * step));
  }
  return [...indices].sort((a, b) => a - b);
}
