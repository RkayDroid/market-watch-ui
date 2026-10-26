import { describe, expect, it } from 'vitest';
import {
  InvalidPayloadError,
  isRecord,
  optionalNumber,
  optionalString,
  requiredDate,
  requiredNumber,
  requiredString,
} from './payload.ts';

const S = 'thing';

describe('payload helpers', () => {
  it('InvalidPayloadError carries subject and reason in its message', () => {
    const err = new InvalidPayloadError('stock details', '"symbol" is missing');
    expect(err.message).toBe('Invalid stock details: "symbol" is missing.');
    expect(err.subject).toBe('stock details');
    expect(err.reason).toBe('"symbol" is missing');
    expect(err.name).toBe('InvalidPayloadError');
  });

  it('isRecord accepts plain objects only', () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord([])).toBe(false);
    expect(isRecord(null)).toBe(false);
    expect(isRecord('x')).toBe(false);
  });

  it('optionalString trims, treats blank/null/undefined as absent and rejects non-strings', () => {
    expect(optionalString(S, ' a ', 'f')).toBe('a');
    expect(optionalString(S, '  ', 'f')).toBeUndefined();
    expect(optionalString(S, null, 'f')).toBeUndefined();
    expect(optionalString(S, undefined, 'f')).toBeUndefined();
    expect(() => optionalString(S, 1, 'f')).toThrow('Invalid thing: "f" is not a string.');
  });

  it('requiredString rejects absent values', () => {
    expect(requiredString(S, 'x', 'f')).toBe('x');
    expect(() => requiredString(S, '', 'f')).toThrow('"f" is missing');
  });

  it('optionalNumber coerces numeric strings and rejects non-finite/boolean values', () => {
    expect(optionalNumber(S, 1.5, 'f')).toBe(1.5);
    expect(optionalNumber(S, '2', 'f')).toBe(2);
    expect(optionalNumber(S, '', 'f')).toBeUndefined();
    expect(optionalNumber(S, null, 'f')).toBeUndefined();
    for (const bad of ['abc', true, Infinity, NaN]) {
      expect(() => optionalNumber(S, bad, 'f')).toThrow('"f" is not a number');
    }
  });

  it('requiredNumber rejects absent values', () => {
    expect(requiredNumber(S, 0, 'f')).toBe(0);
    expect(() => requiredNumber(S, undefined, 'f')).toThrow('"f" is missing');
  });

  it('requiredDate accepts timestamps and bare dates as given, rejecting junk', () => {
    expect(requiredDate(S, '2026-10-22T09:30:00-04:00', 'f')).toBe('2026-10-22T09:30:00-04:00');
    expect(requiredDate(S, '2026-10-19', 'f')).toBe('2026-10-19');
    expect(() => requiredDate(S, 'yesterday', 'f')).toThrow('"f" is not a valid date');
    expect(() => requiredDate(S, null, 'f')).toThrow('"f" is missing');
  });
});
