/**
 * Writes a plain .xlsx workbook: one or more sheets of text and numbers,
 * with a bold, frozen header row and sensible column widths.
 *
 * Every text cell is written as an inline string, never as a formula, so a
 * comment that starts with "=" or "+" cannot run anything when the file is
 * opened. Excel shows it as text.
 */
import { writeZip } from './zip';

export type CellValue = string | number | null | undefined;

export type SheetInput = {
  name: string;
  /** The first row is treated as the header. */
  rows: CellValue[][];
};

// Characters XML 1.0 forbids. They can arrive in pasted text.
const INVALID_XML = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g;

export function escapeXml(text: string): string {
  return text
    .replace(INVALID_XML, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** "A", "B", ... "Z", "AA". Zero based. */
export function columnLetters(index: number): string {
  let n = index + 1;
  let out = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

/**
 * Excel's rules: at most 31 characters, none of []:*?/\ and unique within
 * the workbook, ignoring case.
 */
export function safeSheetNames(names: string[]): string[] {
  const used = new Set<string>();
  return names.map((raw) => {
    const base = (raw.replace(/[[\]:*?/\\]/g, ' ').trim() || 'Sheet').slice(0, 31);
    let name = base;
    for (let n = 2; used.has(name.toLowerCase()); n += 1) {
      const suffix = ` (${n})`;
      name = base.slice(0, 31 - suffix.length) + suffix;
    }
    used.add(name.toLowerCase());
    return name;
  });
}

function cellXml(value: CellValue, ref: string, header: boolean): string {
  const style = header ? ' s="1"' : '';
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return '';
    return `<c r="${ref}"${style}><v>${value}</v></c>`;
  }
  return `<c r="${ref}"${style} t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
}

function sheetXml(rows: CellValue[][]): string {
  const widest = Math.max(1, ...rows.map((row) => row.length));
  const widths = Array.from({ length: widest }, (_, col) => {
    const longest = Math.max(
      ...rows.map((row) => {
        const v = row[col];
        if (v === null || v === undefined) return 0;
        // Long text wraps in practice; cap so one comment does not make a 300 wide column.
        return Math.max(
          ...String(v)
            .split('\n')
            .map((line) => line.length),
        );
      }),
    );
    return Math.min(60, Math.max(8, longest + 2));
  });

  const cols = widths
    .map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`)
    .join('');

  const body = rows
    .map((row, r) => {
      const cells = row
        .map((value, c) => cellXml(value, `${columnLetters(c)}${r + 1}`, r === 0))
        .join('');
      return `<row r="${r + 1}">${cells}</row>`;
    })
    .join('');

  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
    `<cols>${cols}</cols><sheetData>${body}</sheetData></worksheet>`
  );
}

const CONTENT_TYPES = (count: number) =>
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
  '<Default Extension="xml" ContentType="application/xml"/>' +
  '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
  '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
  Array.from(
    { length: count },
    (_, i) =>
      `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
  ).join('') +
  '</Types>';

const ROOT_RELS =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
  '</Relationships>';

/** Two styles: 0 is plain, 1 is the bold header. Text wraps in both. */
const STYLES =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
  '<fonts count="2"><font><sz val="11"/><name val="Arial"/></font><font><b/><sz val="11"/><name val="Arial"/></font></fonts>' +
  '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
  '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="2">' +
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>' +
  '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
  '</cellXfs>' +
  '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
  '</styleSheet>';

export function writeXlsx(sheets: SheetInput[]): Buffer {
  if (sheets.length === 0) throw new Error('A workbook needs at least one sheet.');
  const names = safeSheetNames(sheets.map((s) => s.name));

  const workbook =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
    names
      .map((name, i) => `<sheet name="${escapeXml(name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
      .join('') +
    '</sheets></workbook>';

  const workbookRels =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    names
      .map(
        (_, i) =>
          `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
      )
      .join('') +
    `<Relationship Id="rId${names.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
    '</Relationships>';

  const text = (s: string) => Buffer.from(s, 'utf8');

  return writeZip([
    { name: '[Content_Types].xml', data: text(CONTENT_TYPES(sheets.length)) },
    { name: '_rels/.rels', data: text(ROOT_RELS) },
    { name: 'xl/workbook.xml', data: text(workbook) },
    { name: 'xl/_rels/workbook.xml.rels', data: text(workbookRels) },
    { name: 'xl/styles.xml', data: text(STYLES) },
    ...sheets.map((sheet, i) => ({
      name: `xl/worksheets/sheet${i + 1}.xml`,
      data: text(sheetXml(sheet.rows)),
    })),
  ]);
}
