/**
 * Making sense of Slido's Excel export.
 *
 * Slido's export layout has changed over the years and depends on the
 * licence, so nothing here assumes exact column positions. Each sheet is
 * classified by its name, then by its headers, and only poll and question
 * sheets are kept. Anything else (participant lists, for example, which can
 * hold email addresses) is left out on purpose, so the report only stores
 * what it needs.
 */
import type { SheetOutput } from '@/lib/xlsx/read';

export type SlidoKind = 'polls' | 'questions';

export type ParsedSheet = { kind: SlidoKind; name: string; headers: string[]; rows: string[][] };

export type SlidoParseResult = { kept: ParsedSheet[]; skipped: string[] };

export const SLIDO_LIMITS = {
  maxFileBytes: 5 * 1024 * 1024,
  maxRowsPerSheet: 5000,
} as const;

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

export function classifySlidoSheet(name: string, headers: string[]): SlidoKind | null {
  const n = norm(name);
  if (/particip|attendee|user|people|email/.test(n)) return null;
  if (/poll|survey|quiz/.test(n)) return 'polls';
  if (/question|q ?& ?a|\bqa\b|ideas?/.test(n)) return 'questions';

  const h = headers.map(norm);
  if (h.some((x) => /e-?mail/.test(x))) return null;
  if (h.some((x) => /^votes?$|vote count|responses?$/.test(x))) return 'polls';
  if (h.some((x) => /likes?|upvotes?/.test(x))) return 'questions';
  return null;
}

const filled = (row: string[]) => row.filter((c) => c.trim() !== '').length;

/**
 * Slido sometimes puts a title or a blank line above the table. The header
 * is the first row that is about as wide as the widest row in the sheet.
 */
export function findHeaderRow(rows: string[][]): number {
  const widest = Math.max(0, ...rows.slice(0, 50).map(filled));
  if (widest === 0) return -1;
  const needed = Math.max(2, Math.ceil(widest / 2));
  const index = rows.findIndex((row) => filled(row) >= Math.min(needed, widest));
  return index;
}

export function parseSlidoWorkbook(sheets: SheetOutput[]): SlidoParseResult {
  const kept: ParsedSheet[] = [];
  const skipped: string[] = [];

  for (const sheet of sheets) {
    const headerAt = findHeaderRow(sheet.rows);
    if (headerAt < 0) {
      skipped.push(sheet.name);
      continue;
    }
    const rawHeaders = sheet.rows[headerAt] ?? [];
    // Trim trailing empty header cells, then name any gaps.
    let width = rawHeaders.length;
    while (width > 0 && (rawHeaders[width - 1] ?? '').trim() === '') width -= 1;
    const headers = rawHeaders.slice(0, width).map((h, i) => h.trim() || `Column ${i + 1}`);

    const kind = classifySlidoSheet(sheet.name, headers);
    if (!kind) {
      skipped.push(sheet.name);
      continue;
    }

    const rows = sheet.rows
      .slice(headerAt + 1)
      .filter((row) => filled(row) > 0)
      .slice(0, SLIDO_LIMITS.maxRowsPerSheet)
      .map((row) => Array.from({ length: width }, (_, i) => (row[i] ?? '').trim()));

    kept.push({ kind, name: sheet.name, headers, rows });
  }

  return { kept, skipped };
}

/* ------------------------------------------------------------- highlights */

function findColumn(headers: string[], pattern: RegExp): number {
  return headers.findIndex((h) => pattern.test(norm(h)));
}

const toNumber = (value: string | undefined) => {
  const n = Number((value ?? '').replace(/[,%\s]/g, ''));
  return Number.isFinite(n) ? n : null;
};

export type SlidoHighlights = {
  pollSheets: number;
  pollRows: number;
  questionSheets: number;
  questionRows: number;
  /** Most liked questions, when the sheet has a likes column. */
  topQuestions: { text: string; likes: number }[];
  /** Each poll with its winning option, when the sheet has the columns for it. */
  pollWinners: { poll: string; option: string; votes: number }[];
};

export function slidoHighlights(
  sheets: { kind: string; headers: string[]; rows: string[][] }[],
): SlidoHighlights {
  const out: SlidoHighlights = {
    pollSheets: 0,
    pollRows: 0,
    questionSheets: 0,
    questionRows: 0,
    topQuestions: [],
    pollWinners: [],
  };

  for (const sheet of sheets) {
    if (sheet.kind === 'questions') {
      out.questionSheets += 1;
      out.questionRows += sheet.rows.length;
      const text = findColumn(sheet.headers, /^(question|content|text|idea)/);
      const likes = findColumn(sheet.headers, /likes?|upvotes?|votes?/);
      if (text >= 0 && likes >= 0) {
        for (const row of sheet.rows) {
          const n = toNumber(row[likes]);
          if (row[text] && n !== null)
            out.topQuestions.push({ text: row[text] as string, likes: n });
        }
      }
    } else if (sheet.kind === 'polls') {
      out.pollSheets += 1;
      out.pollRows += sheet.rows.length;
      const poll = findColumn(sheet.headers, /^(poll|question|title)/);
      const option = findColumn(sheet.headers, /option|answer|choice|response$/);
      const votes = findColumn(sheet.headers, /^votes?$|vote count|^count$|^responses?$/);
      if (poll >= 0 && option >= 0 && votes >= 0) {
        const best = new Map<string, { option: string; votes: number }>();
        let lastPoll = '';
        for (const row of sheet.rows) {
          // Slido often only writes the poll name on its first option row.
          const name = row[poll] || lastPoll;
          lastPoll = name;
          const n = toNumber(row[votes]);
          if (!name || n === null || !row[option]) continue;
          const current = best.get(name);
          if (!current || n > current.votes)
            best.set(name, { option: row[option] as string, votes: n });
        }
        for (const [name, b] of best) out.pollWinners.push({ poll: name, ...b });
      }
    }
  }

  out.topQuestions.sort((a, b) => b.likes - a.likes);
  out.topQuestions = out.topQuestions.slice(0, 5);
  return out;
}
