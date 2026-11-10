/**
 * The committee summary (an extra from the brief): an admin uploads a
 * committee's Excel, and the portal shows a simple read only summary.
 *
 * The layout of those workbooks is not fixed, so nothing here assumes column
 * names. Each sheet becomes a table as it stands, and columns that look like
 * categories (a status, a decision, a division) get a count of each value.
 * No AI, just counting. Pure functions, see logic.test.ts.
 */
import type { ImportSource } from '@/data/types';
import type { SheetOutput } from '@/lib/xlsx/read';
import { findHeaderRow } from '@/modules/reports/slido';

export const COMMITTEE_LIMITS = {
  maxFileBytes: 5 * 1024 * 1024,
  maxSheets: 10,
  maxRowsPerSheet: 2000,
  maxColumns: 30,
} as const;

export function committeeSource(id: string): ImportSource {
  return `committee:${id}`;
}

/* ----------------------------------------------------------------- access */

export const COMMITTEE_ACCESS_KEY = 'committees.access';

/**
 * Who can see the summaries. There is no personal login yet (AUTH_MODE is
 * "none"), so the honest choices are: only desks signed in with the PIN, or
 * anyone who has the portal link.
 */
export const COMMITTEE_ACCESS = ['secretariat', 'everyone'] as const;
export type CommitteeAccess = (typeof COMMITTEE_ACCESS)[number];

/** Anything unknown means the stricter choice. */
export function resolveCommitteeAccess(stored: string | null): CommitteeAccess {
  return stored === 'everyone' ? 'everyone' : 'secretariat';
}

export function committeeAccessLabel(access: CommitteeAccess): string {
  return access === 'everyone' ? 'Anyone with the portal link' : 'Secretariat only';
}

/* ---------------------------------------------------------------- parsing */

export type CommitteeSheet = { kind: 'table'; name: string; headers: string[]; rows: string[][] };

const filled = (row: string[]) => row.filter((c) => c.trim() !== '').length;

/** Every sheet that holds a table, trimmed to its header and filled rows. */
export function parseCommitteeWorkbook(sheets: SheetOutput[]): {
  kept: CommitteeSheet[];
  skipped: string[];
} {
  const kept: CommitteeSheet[] = [];
  const skipped: string[] = [];

  for (const sheet of sheets.slice(0, COMMITTEE_LIMITS.maxSheets)) {
    const headerAt = findHeaderRow(sheet.rows);
    const raw = headerAt >= 0 ? (sheet.rows[headerAt] ?? []) : [];
    let width = Math.min(raw.length, COMMITTEE_LIMITS.maxColumns);
    while (width > 0 && (raw[width - 1] ?? '').trim() === '') width -= 1;

    const rows =
      headerAt >= 0
        ? sheet.rows
            .slice(headerAt + 1)
            .filter((row) => filled(row.slice(0, width)) > 0)
            .slice(0, COMMITTEE_LIMITS.maxRowsPerSheet)
            .map((row) => Array.from({ length: width }, (_, i) => (row[i] ?? '').trim()))
        : [];

    if (width < 2 || rows.length === 0) {
      skipped.push(sheet.name);
      continue;
    }

    kept.push({
      kind: 'table',
      name: sheet.name,
      headers: raw.slice(0, width).map((h, i) => h.trim() || `Column ${i + 1}`),
      rows,
    });
  }

  return { kept, skipped };
}

/* ---------------------------------------------------------------- summary */

export type ColumnTally = { header: string; counts: { value: string; count: number }[] };

/**
 * Columns worth counting: a handful of repeated values, like a decision or
 * a division. A column of titles or reference numbers (nearly all different)
 * is not, and neither is one that is mostly empty.
 */
export function columnTallies(headers: string[], rows: string[][], maxDistinct = 8): ColumnTally[] {
  if (rows.length < 3) return [];
  const out: ColumnTally[] = [];

  headers.forEach((header, col) => {
    const counts = new Map<string, number>();
    let present = 0;
    for (const row of rows) {
      const value = (row[col] ?? '').trim();
      if (!value) continue;
      present += 1;
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    const distinct = counts.size;
    const repeated = distinct >= 2 && distinct <= maxDistinct && distinct <= present / 2;
    if (!repeated || present < rows.length / 2) return;

    out.push({
      header,
      counts: [...counts.entries()]
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value)),
    });
  });

  return out;
}
