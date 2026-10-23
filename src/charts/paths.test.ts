import { describe, expect, it } from 'vitest';
import { buildAreaPath, buildLinePath } from './paths.ts';

describe('buildLinePath', () => {
  it('returns empty for no points', () => {
    expect(buildLinePath([])).toBe('');
  });

  it('builds M/L commands with 2-decimal rounding', () => {
    expect(
      buildLinePath([
        { x: 0, y: 10.123 },
        { x: 50.5, y: 20 },
        { x: 100, y: 0.005 },
      ]),
    ).toBe('M0 10.12 L50.5 20 L100 0.01');
  });
});

describe('buildAreaPath', () => {
  it('closes the line down to the baseline', () => {
    expect(
      buildAreaPath(
        [
          { x: 0, y: 10 },
          { x: 100, y: 20 },
        ],
        300,
      ),
    ).toBe('M0 10 L100 20 L100 300 L0 300 Z');
  });

  it('returns empty for no points', () => {
    expect(buildAreaPath([], 300)).toBe('');
  });
});
