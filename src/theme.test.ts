import { describe, expect, it } from 'vitest';
import { BRAND_PURPLE, theme } from './theme.ts';

describe('theme', () => {
  it('is a compact light theme', () => {
    expect(theme.palette.mode).toBe('light');
    expect(theme.typography.fontSize).toBe(13);
    expect(theme.shape.borderRadius).toBe(6);
  });

  it('defaults Papers to flat/bordered and text fields to small', () => {
    expect(theme.components?.MuiPaper?.defaultProps).toMatchObject({ elevation: 0 });
    expect(theme.components?.MuiTextField?.defaultProps).toMatchObject({ size: 'small' });
    expect(theme.components?.MuiButton?.defaultProps).toMatchObject({ disableElevation: true });
  });

  it('carries the brand purple of the favicon/hero/icon sprite as the secondary colour', () => {
    expect(BRAND_PURPLE).toBe('#863bff');
    expect(theme.palette.secondary.main).toBe(BRAND_PURPLE);
  });
});
