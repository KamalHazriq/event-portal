/**
 * Turns the attendee CSV into rows the data adapter can store.
 *
 * Expected columns (brief Module 4): no, staff_no, name, title, department,
 * remark. Column order does not matter and the names are matched loosely, so
 * a file edited by hand still loads.
 */
import type { AttendeeImportRow } from '@/data/types';

import { parseCsvRecords } from './csv';
import { plainText } from './text';

export type AttendeeCsvProblem = { row: number; reason: string };

export type AttendeeCsvResult = {
  rows: AttendeeImportRow[];
  problems: AttendeeCsvProblem[];
};

const REQUIRED_COLUMNS = ['staff_no', 'name'] as const;

/** Reads one of several acceptable spellings for a column. */
function field(record: Record<string, string>, ...names: string[]): string {
  for (const name of names) {
    const value = record[name];
    if (typeof value === 'string' && value.length > 0) return value;
  }
  return '';
}

/**
 * The secretariat are flagged so the lucky draw can leave them out. Either
 * the remark or the department can say so.
 */
function looksLikeSecretariat(department: string, remark: string): boolean {
  return /secretariat/i.test(`${department} ${remark}`);
}

export function parseAttendeeCsv(text: string): AttendeeCsvResult {
  const records = parseCsvRecords(text);
  const problems: AttendeeCsvProblem[] = [];

  if (records.length === 0) {
    return {
      rows: [],
      problems: [{ row: 1, reason: 'the file has no rows under the header' }],
    };
  }

  const firstRecord = records[0] as Record<string, string>;
  const missing = REQUIRED_COLUMNS.filter((column) => !(column in firstRecord));
  if (missing.length > 0) {
    return {
      rows: [],
      problems: [
        {
          row: 1,
          reason: `the header row is missing: ${missing.join(', ')}. Expected columns are no, staff_no, name, title, department, remark.`,
        },
      ],
    };
  }

  const rows: AttendeeImportRow[] = [];
  const seenStaffNumbers = new Map<string, number>();

  records.forEach((record, index) => {
    // Header is line 1, so the first data row is line 2.
    const line = index + 2;

    const staffNo = plainText(field(record, 'staff_no', 'staffno', 'staff_number'), 40);
    const name = plainText(field(record, 'name', 'full_name'), 120);

    if (staffNo.length === 0 && name.length === 0) return; // blank row, ignore
    if (staffNo.length === 0) {
      problems.push({ row: line, reason: 'no staff_no' });
      return;
    }
    if (name.length === 0) {
      problems.push({ row: line, reason: 'no name' });
      return;
    }

    const duplicateOf = seenStaffNumbers.get(staffNo);
    if (duplicateOf !== undefined) {
      problems.push({
        row: line,
        reason: `staff_no ${staffNo} is already used on line ${duplicateOf}`,
      });
      return;
    }
    seenStaffNumbers.set(staffNo, line);

    const department = plainText(field(record, 'department', 'division', 'dept'), 120);
    const remark = plainText(field(record, 'remark', 'remarks', 'notes'), 300);
    const rawNo = field(record, 'no', 'number', 'no.');
    const parsedNo = Number.parseInt(rawNo, 10);

    rows.push({
      no: Number.isFinite(parsedNo) ? parsedNo : null,
      staffNo,
      name,
      title: plainText(field(record, 'title', 'position', 'job_title'), 200),
      department,
      remark,
      isSecretariat: looksLikeSecretariat(department, remark),
    });
  });

  return { rows, problems };
}
