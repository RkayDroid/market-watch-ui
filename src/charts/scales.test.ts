import { describe, expect, it } from 'vitest';
import { createLinearScale, generateTicks, niceStep, padDomain, selectTickIndices } from './scales.ts';

describe('createLinearScale', () => {
  it('maps domain to range linearly, including inverted ranges', () => {
    const s = createLinearScale([0, 10], [100, 200]);
    expect(s(0)).toBe(100);
    expect(s(5)).toBe(150);
    expect(s(10)).toBe(200);

    const inverted = createLinearScale([0, 10], [200, 100]);
    expect(inverted(2.5)).toBe(175);
  });

  it('maps a degenerate domain to the range midpoint', () => {
    expect(createLinearScale([5, 5], [0, 100])(5)).toBe(50);
    expect(createLinearScale([5, 5], [0, 100])(999)).toBe(50);
  });
});

describe('padDomain', () => {
  it('pads by the ratio on each side', () => {
    expect(padDomain(100, 200, 0.1)).toEqual([90, 210]);
  });

  it('pads a flat series so it still has height', () => {
    expect(padDomain(200, 200)).toEqual([198, 202]);
    expect(padDomain(0, 0)).toEqual([-1, 1]);
  });
});

describe('niceStep', () => {
  it.each([
    [0.13, 0.2],
    [1, 1],
    [1.5, 2],
    [3.2, 5],
    [7, 10],
    [23, 50],
    [0, 1],
  ])('niceStep(%s) → %s', (raw, expected) => {
    expect(niceStep(raw)).toBeCloseTo(expected, 10);
  });
});

describe('generateTicks', () => {
  it('produces nice, evenly spaced ticks within the domain', () => {
    expect(generateTicks(274.03, 283.27, 5)).toEqual([276, 278, 280, 282]);
    expect(generateTicks(0, 100, 5)).toEqual([0, 20, 40, 60, 80, 100]);
  });

  it('handles degenerate and invalid input', () => {
    expect(generateTicks(5, 5)).toEqual([5]);
    expect(generateTicks(10, 0)).toEqual([]);
    expect(generateTicks(0, 10, 0)).toEqual([]);
  });

  it('avoids floating point drift in tick values', () => {
    for (const t of generateTicks(0.1, 0.9, 4)) {
      expect(t.toString().length).toBeLessThanOrEqual(4);
    }
  });
});

describe('selectTickIndices', () => {
  it('returns every index when there is room', () => {
    expect(selectTickIndices(4, 6)).toEqual([0, 1, 2, 3]);
  });

  it('spreads ticks evenly and always includes first and last', () => {
    expect(selectTickIndices(24, 6)).toEqual([0, 5, 9, 14, 18, 23]);
    expect(selectTickIndices(24, 2)).toEqual([0, 23]);
  });

  it('handles edge cases', () => {
    expect(selectTickIndices(0, 5)).toEqual([]);
    expect(selectTickIndices(5, 0)).toEqual([]);
    expect(selectTickIndices(1, 5)).toEqual([0]);
    expect(selectTickIndices(5, 1)).toEqual([0]);
  });
});
