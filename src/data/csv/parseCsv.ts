/**
 * Minimal, dependency-free CSV parser.
 *
 * Supports:
 *  - comma-delimited fields
 *  - double-quoted fields containing commas, newlines or escaped quotes ("")
 *  - LF and CRLF line endings
 *  - blank lines (ignored)
 *
 * The first non-blank line is treated as the header row.
 */

export interface CsvRow {
  /** 1-based line number the row started on in the source text (useful for error messages). */
  line: number;
  values: Record<string, string>;
}

export interface CsvDocument {
  headers: string[];
  rows: CsvRow[];
}

export class CsvParseError extends Error {
  readonly line: number;

  constructor(message: string, line: number) {
    super(`CSV line ${line}: ${message}`);
    this.name = 'CsvParseError';
    this.line = line;
  }
}

interface RawRecord {
  line: number;
  fields: string[];
}

/**
 * Tokenises CSV text into records of raw string fields.
 * Exported separately so header handling can be tested independently.
 */
export function tokenizeCsv(text: string): RawRecord[] {
  const records: RawRecord[] = [];
  let fields: string[] = [];
  let field = '';
  let inQuotes = false;
  let line = 1;
  let recordStartLine = 1;
  let recordHasContent = false;

  const pushRecord = () => {
    fields.push(field);
    if (recordHasContent || fields.length > 1) {
      records.push({ line: recordStartLine, fields });
    }
    fields = [];
    field = '';
    recordHasContent = false;
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        if (ch === '\n') line++;
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      recordHasContent = true;
    } else if (ch === ',') {
      fields.push(field);
      field = '';
      recordHasContent = true;
    } else if (ch === '\r') {
      // swallow; handled by the following '\n' (or end of text)
    } else if (ch === '\n') {
      pushRecord();
      line++;
      recordStartLine = line;
    } else {
      field += ch;
      if (ch.trim() !== '') recordHasContent = true;
    }
  }

  if (inQuotes) {
    throw new CsvParseError('unterminated quoted field', recordStartLine);
  }

  if (field !== '' || fields.length > 0) {
    pushRecord();
  }

  return records;
}

/**
 * Parses CSV text into header-keyed rows. Field values are trimmed.
 * Throws {@link CsvParseError} if a row's field count does not match the header.
 */
export function parseCsv(text: string): CsvDocument {
  const records = tokenizeCsv(text);
  if (records.length === 0) {
    return { headers: [], rows: [] };
  }

  const [headerRecord, ...dataRecords] = records;
  const headers = headerRecord.fields.map((h) => h.trim());

  const rows = dataRecords.map(({ line, fields }) => {
    if (fields.length !== headers.length) {
      throw new CsvParseError(
        `expected ${headers.length} fields but found ${fields.length}`,
        line,
      );
    }
    const values: Record<string, string> = {};
    headers.forEach((header, idx) => {
      values[header] = fields[idx].trim();
    });
    return { line, values };
  });

  return { headers, rows };
}
