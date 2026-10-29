import { describe, expect, it } from 'vitest';
import { isIsoDate, todayIsoDate, toIsoDate, validateReferenceDate } from './date.ts';

describe('toIsoDate / todayIsoDate', () => {
  it('formats local calendar dates zero-padded as YYYY-MM-DD', () => {
    expect(toIsoDate(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(toIsoDate(new Date(2026, 9, 28))).toBe('2026-10-28');
    expect(todayIsoDate(new Date(2024, 1, 29))).toBe('2024-02-29');
  });

  it('defaults to now', () => {
    expect(todayIsoDate()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(todayIsoDate()).toBe(toIsoDate(new Date()));
  });
});

describe('isIsoDate', () => {
  it.each(['2026-10-28', '2024-02-29', '1999-12-31'])('accepts %s', (v) => expect(isIsoDate(v)).toBe(true));
  it.each(['2026-02-30', '2023-02-29', '2026-13-01', '2026-00-10', '2026-10-32', '26-10-28', '2026/10/28', '10/28/2026', '', 'today'])(
    'rejects %s',
    (v) => expect(isIsoDate(v)).toBe(false),
  );
});

describe('validateReferenceDate', () => {
  const today = '2026-10-28';

  it('accepts no date at all (the field is optional)', () => {
    expect(validateReferenceDate('', today)).toBeNull();
    expect(validateReferenceDate('   ', today)).toBeNull();
  });

  it('accepts today and any earlier real date', () => {
    expect(validateReferenceDate('2026-10-28', today)).toBeNull();
    expect(validateReferenceDate('2025-10-10', today)).toBeNull();
    expect(validateReferenceDate(' 2026-02-02 ', today)).toBeNull();
  });

  it.each([
    ['28/10/2026', 'Use the format YYYY-MM-DD.'],
    ['2026-10-2', 'Use the format YYYY-MM-DD.'],
    ['2026-02-30', 'Not a valid calendar date.'],
    ['2026-10-29', 'Cannot be after today (2026-10-28).'],
    ['2027-01-01', 'Cannot be after today (2026-10-28).'],
  ])('explains why %j is rejected', (value, message) => {
    expect(validateReferenceDate(value, today)).toBe(message);
  });
});
