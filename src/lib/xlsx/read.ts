/**
 * Reads the text out of an .xlsx workbook: each sheet as rows of strings.
 *
 * Used for the Slido export (and later the committee Excel). It reads values
 * only: no formulas are evaluated, no styles, no macros, nothing that could
 * run. Numbers come back as their text, dates as Excel's serial number.
 *
 * The XML Excel writes is regular, so a few careful patterns are enough and
 * no XML library is needed.
 */
import { readZip, ZipError } from './zip';
import { columnLetters } from './write';

export { ZipError as XlsxError };

export type SheetOutput = { name: string; rows: string[][] };

export type ReadXlsxLimits = {
  maxSheets?: number;
  maxRows?: number;
  maxColumns?: number;
  maxCellLength?: number;
};

export function decodeXml(text: string): string {
  return text.replace(/&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos);/g, (_, code: string) => {
    if (code === 'amp') return '&';
    if (code === 'lt') return '<';
    if (code === 'gt') return '>';
    if (code === 'quot') return '"';
    if (code === 'apos') return "'";
    const n = code.startsWith('#x') ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
    return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : '';
  });
}

function attr(tag: string, name: string): string | null {
  const match = new RegExp(`\\s${name}="([^"]*)"`).exec(tag);
  return match ? decodeXml(match[1] as string) : null;
}

/** All the text inside <t> elements, which is how Excel stores rich text runs. */
function textRuns(xml: string): string {
  let out = '';
  for (const m of xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)) out += decodeXml(m[1] as string);
  return out;
}

/** "C12" to 2. */
export function columnIndex(ref: string): number {
  const letters = /^[A-Z]+/.exec(ref)?.[0] ?? 'A';
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function resolveTarget(target: string): string {
  const clean = target.replace(/^\//, '');
  return clean.startsWith('xl/') ? clean : `xl/${clean}`;
}

export function readXlsx(file: Buffer, limits: ReadXlsxLimits = {}): SheetOutput[] {
  const maxSheets = limits.maxSheets ?? 30;
  const maxRows = limits.maxRows ?? 10_000;
  const maxColumns = limits.maxColumns ?? 60;
  const maxCell = limits.maxCellLength ?? 4000;

  const files = readZip(file, {
    include: (name) =>
      name === 'xl/workbook.xml' ||
      name === 'xl/_rels/workbook.xml.rels' ||
      name === 'xl/sharedStrings.xml' ||
      name.startsWith('xl/worksheets/'),
  });

  const workbook = files.get('xl/workbook.xml')?.toString('utf8');
  const rels = files.get('xl/_rels/workbook.xml.rels')?.toString('utf8');
  if (!workbook || !rels) throw new ZipError('This is not an Excel workbook.');

  const targets = new Map<string, string>();
  for (const m of rels.matchAll(/<Relationship\b[^>]*>/g)) {
    const id = attr(m[0], 'Id');
    const target = attr(m[0], 'Target');
    if (id && target) targets.set(id, resolveTarget(target));
  }

  const shared: string[] = [];
  const sharedXml = files.get('xl/sharedStrings.xml')?.toString('utf8') ?? '';
  for (const m of sharedXml.matchAll(/<si>([\s\S]*?)<\/si>/g))
    shared.push(textRuns(m[1] as string));

  const sheets: SheetOutput[] = [];
  for (const m of workbook.matchAll(/<sheet\b[^>]*>/g)) {
    if (sheets.length >= maxSheets) break;
    const name = attr(m[0], 'name') ?? `Sheet${sheets.length + 1}`;
    const id = attr(m[0], 'r:id');
    const path = id ? targets.get(id) : undefined;
    const xml = path ? files.get(path)?.toString('utf8') : undefined;
    if (!xml) continue;

    const rows: string[][] = [];
    for (const rowMatch of xml.matchAll(/<row\b[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g)) {
      if (rows.length >= maxRows) break;
      const rowNumber = Number(attr(rowMatch[0], 'r') ?? rows.length + 1);
      const row: string[] = [];

      for (const cell of (rowMatch[1] ?? '').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const head = cell[1] ?? '';
        const inner = cell[2] ?? '';
        const ref = attr(head, 'r');
        const col = ref ? columnIndex(ref) : row.length;
        if (col >= maxColumns) continue;

        const type = attr(head, 't');
        const v = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1];
        let value = '';
        if (type === 's') value = shared[Number(v)] ?? '';
        else if (type === 'inlineStr') value = textRuns(inner);
        else if (type === 'b') value = v === '1' ? 'TRUE' : 'FALSE';
        else if (v !== undefined) value = decodeXml(v);

        while (row.length < col) row.push('');
        row[col] = value.slice(0, maxCell);
      }

      // Keep blank rows where they were, so row numbers in error messages match Excel.
      while (rows.length < rowNumber - 1 && rows.length < maxRows) rows.push([]);
      if (rows.length < maxRows) rows.push(row);
    }

    sheets.push({ name, rows });
  }

  return sheets;
}

// Re-exported for tests and callers that want to build references.
export { columnLetters };
