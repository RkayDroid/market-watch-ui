import { describe, expect, it } from 'vitest';
import { CsvParseError, parseCsv, tokenizeCsv } from './parseCsv.ts';

describe('tokenizeCsv', () => {
  it('splits simple rows on commas and newlines', () => {
    expect(tokenizeCsv('a,b\n1,2\n')).toEqual([
      { line: 1, fields: ['a', 'b'] },
      { line: 2, fields: ['1', '2'] },
    ]);
  });

  it('handles CRLF line endings', () => {
    expect(tokenizeCsv('a,b\r\n1,2\r\n')).toEqual([
      { line: 1, fields: ['a', 'b'] },
      { line: 2, fields: ['1', '2'] },
    ]);
  });

  it('ignores blank and whitespace-only lines but keeps line numbering', () => {
    expect(tokenizeCsv('a,b\n\n   \n1,2')).toEqual([
      { line: 1, fields: ['a', 'b'] },
      { line: 4, fields: ['1', '2'] },
    ]);
  });

  it('supports quoted fields with commas, escaped quotes and newlines', () => {
    expect(tokenizeCsv('"x, y","say ""hi""","multi\nline"')).toEqual([
      { line: 1, fields: ['x, y', 'say "hi"', 'multi\nline'] },
    ]);
  });

  it('preserves empty fields', () => {
    expect(tokenizeCsv('a,,c')).toEqual([{ line: 1, fields: ['a', '', 'c'] }]);
  });

  it('throws on an unterminated quote', () => {
    expect(() => tokenizeCsv('a,"b')).toThrow(CsvParseError);
  });
});

describe('parseCsv', () => {
  it('returns empty document for empty input', () => {
    expect(parseCsv('')).toEqual({ headers: [], rows: [] });
    expect(parseCsv('\n\n')).toEqual({ headers: [], rows: [] });
  });

  it('maps rows to header-keyed objects and trims values', () => {
    const doc = parseCsv(' symbol , rate \n AAPL , 1.5 \n');
    expect(doc.headers).toEqual(['symbol', 'rate']);
    expect(doc.rows).toEqual([{ line: 2, values: { symbol: 'AAPL', rate: '1.5' } }]);
  });

  it('reports the offending line when the field count is wrong', () => {
    expect(() => parseCsv('a,b\n1,2\n3\n')).toThrow(/line 3: expected 2 fields but found 1/);
  });
});
