/**
 * Small validation helpers shared by the API payload parsers. Each parser turns an
 * untrusted `unknown` body into a typed model, throwing {@link InvalidPayloadError}
 * with a human-readable reason for anything off-contract.
 */

export class InvalidPayloadError extends Error {
  /** What was being parsed, e.g. "stock details". */
  readonly subject: string;
  readonly reason: string;

  constructor(subject: string, reason: string) {
    super(`Invalid ${subject}: ${reason}.`);
    this.name = 'InvalidPayloadError';
    this.subject = subject;
    this.reason = reason;
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Accepts a non-blank string; `null`/`undefined` mean "not provided"; anything else is invalid. */
export function optionalString(subject: string, value: unknown, field: string): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') throw new InvalidPayloadError(subject, `"${field}" is not a string`);
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

export function requiredString(subject: string, value: unknown, field: string): string {
  const str = optionalString(subject, value, field);
  if (str === undefined) throw new InvalidPayloadError(subject, `"${field}" is missing`);
  return str;
}

/** Accepts a finite number or numeric string; `null`/`undefined`/`""` mean "not provided". */
export function optionalNumber(subject: string, value: unknown, field: string): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const num = typeof value === 'number' ? value : Number(value);
  if (typeof value === 'boolean' || !Number.isFinite(num)) {
    throw new InvalidPayloadError(subject, `"${field}" is not a number`);
  }
  return num;
}

export function requiredNumber(subject: string, value: unknown, field: string): number {
  const num = optionalNumber(subject, value, field);
  if (num === undefined) throw new InvalidPayloadError(subject, `"${field}" is missing`);
  return num;
}

/** A parseable ISO-8601 timestamp or bare `YYYY-MM-DD` date, returned as given (trimmed). */
export function requiredDate(subject: string, value: unknown, field: string): string {
  const str = requiredString(subject, value, field);
  if (Number.isNaN(Date.parse(str))) throw new InvalidPayloadError(subject, `"${field}" is not a valid date`);
  return str;
}
