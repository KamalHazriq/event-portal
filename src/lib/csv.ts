/**
 * A small CSV reader.
 *
 * The attendee list arrives as a spreadsheet export, which means quoted
 * fields, commas inside names, the odd stray quote and sometimes a BOM at the
 * front. Those are handled here rather than pulling in a CSV library, since
 * this is the only CSV the portal reads (brief: keep dependencies minimal).
 */

/** Splits CSV text into rows of cells. Handles quotes, commas and CRLF. */
export function parseCsv(text: string): string[][] {
  // Excel writes a byte order mark that would otherwise end up in the first
  // column name.
  const input = text.replace(/^﻿/, '');

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];

    if (inQuotes) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          // A doubled quote inside a quoted field is one literal quote.
          cell += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(cell);
      cell = '';
    } else if (char === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (char === '\r') {
      // Part of a CRLF line ending. The \n that follows ends the row.
    } else {
      cell += char ?? '';
    }
  }

  // Whatever is left when the text runs out is the last row, unless the file
  // simply ended with a newline.
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}

/**
 * Reads CSV with a header row into objects keyed by column name.
 *
 * Column names are lower cased and spaces become underscores, so "Staff No"
 * and "staff_no" both work. People edit these files by hand.
 */
export function parseCsvRecords(text: string): Record<string, string>[] {
  const rows = parseCsv(text).filter((row) => row.some((cell) => cell.trim().length > 0));
  const headerRow = rows[0];
  if (!headerRow) return [];

  const headers = headerRow.map((name) => name.trim().toLowerCase().replace(/\s+/g, '_'));

  return rows.slice(1).map((row) => {
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      if (header.length > 0) record[header] = (row[index] ?? '').trim();
    });
    return record;
  });
}
