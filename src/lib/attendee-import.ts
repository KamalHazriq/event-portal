/**
 * Turns the attendee CSV into rows the data adapter can store.
 *
 * Expected columns (brief Module 4): no, staff_no, name, title, department,
 * remark. Column order does not matter and the names are matched loosely, so
 * a file edited by hand still loads.
 *
 * The HR list export loads as it comes, too: "Holder" is the staff number,
 * "Complete Name" the name, "Position Text" the title, and any column whose
 * name starts with "Remarks" (it carries a date, such as "Remarks (27Oct2026)")
 * is the remark. Department is optional; without it the headcount simply
 * groups everyone under "No department".
 */
import type { AttendeeImportRow } from '@/data/types';

import { parseCsvRecords } from './csv';
import { plainText } from './text';

export type AttendeeCsvProblem = { row: number; reason: string };

export type AttendeeCsvResult = {
  rows: AttendeeImportRow[];
  problems: AttendeeCsvProblem[];
};

/** Every accepted spelling of each column, after lower casing and spaces to underscores. */
const COLUMNS = {
  staffNo: [
    'staff_no',
    'staffno',
    'staff_number',
    'staff_id',
    'holder',
    'personnel_no',
    'employee_no',
  ],
  name: ['name', 'full_name', 'complete_name'],
  title: ['title', 'position', 'job_title', 'position_text', 'designation', 'role'],
  department: ['department', 'division', 'dept', 'department_name', 'unit'],
  remark: ['remark', 'remarks', 'notes', 'note'],
  email: ['email', 'e-mail', 'email_address', 'work_email', 'e-mail_address'],
  no: ['no', 'number', 'no.', 'bil'],
} as const;

/** Reads one of several acceptable spellings for a column. */
function field(record: Record<string, string>, ...names: readonly string[]): string {
  for (const name of names) {
    const value = record[name];
    if (typeof value === 'string' && value.length > 0) return value;
  }
  return '';
}

/** A remarks column with something after the word, such as "remarks_(27oct2026)". */
function datedRemark(record: Record<string, string>): string {
  for (const [key, value] of Object.entries(record)) {
    if (/^remarks?[_(]/.test(key) && value.length > 0) return value;
  }
  return '';
}

function hasColumn(record: Record<string, string>, names: readonly string[]): boolean {
  return names.some((name) => name in record);
}

/**
 * The secretariat are flagged so the lucky draw can leave them out. The
 * department, the role or the remark can say so.
 */
function looksLikeSecretariat(department: string, remark: string, title = ''): boolean {
  return /secretariat/i.test(`${department} ${remark} ${title}`);
}

/**
 * People with no staff number, such as external pilots, get a stand in made
 * from their name, so they can still be checked in. It is the same every
 * time the list is imported, so re-importing updates them rather than
 * adding them again.
 */
export function standInStaffNo(name: string): string {
  const slug = name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
  return `EXT-${slug}`;
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
  const missing = [
    ...(hasColumn(firstRecord, COLUMNS.staffNo) ? [] : ['staff_no (or Holder)']),
    ...(hasColumn(firstRecord, COLUMNS.name) ? [] : ['name (or Complete Name)']),
  ];
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

    const name = plainText(field(record, ...COLUMNS.name), 120);
    const givenStaffNo = plainText(field(record, ...COLUMNS.staffNo), 40);

    if (givenStaffNo.length === 0 && name.length === 0) return; // blank row, ignore
    const staffNo = givenStaffNo || standInStaffNo(name);
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

    const department = plainText(field(record, ...COLUMNS.department), 120);
    const remark = plainText(field(record, ...COLUMNS.remark) || datedRemark(record), 300);
    const title = plainText(field(record, ...COLUMNS.title), 200);
    const email = plainText(field(record, ...COLUMNS.email), 200).toLowerCase();
    const rawNo = field(record, ...COLUMNS.no);
    const parsedNo = Number.parseInt(rawNo, 10);

    rows.push({
      no: Number.isFinite(parsedNo) ? parsedNo : null,
      staffNo,
      name,
      title,
      department,
      remark,
      ...(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? { email } : {}),
      isSecretariat: looksLikeSecretariat(department, remark, title),
    });
  });

  return { rows, problems };
}
