/** Calendar-date helpers for the reference date (`YYYY-MM-DD`, no time zone). */

export const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Zero-padded `YYYY-MM-DD` of a `Date` in the local time zone. */
export function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Today's local calendar date as `YYYY-MM-DD`; `now` is injectable for tests. */
export function todayIsoDate(now: Date = new Date()): string {
  return toIsoDate(now);
}

/** True for a `YYYY-MM-DD` string that names a real calendar date (so not `2026-02-30`). */
export function isIsoDate(value: string): boolean {
  if (!ISO_DATE_PATTERN.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/**
 * Why `value` is not an acceptable reference date, or `null` when it is. The reference date
 * is optional, so a blank value is fine; anything after `max` (normally today) is rejected.
 * `YYYY-MM-DD` strings compare correctly as plain strings.
 */
export function validateReferenceDate(value: string, max: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!ISO_DATE_PATTERN.test(trimmed)) return 'Use the format YYYY-MM-DD.';
  if (!isIsoDate(trimmed)) return 'Not a valid calendar date.';
  if (trimmed > max) return `Cannot be after today (${max}).`;
  return null;
}
