import { describe, expect, it } from 'vitest';

import {
  columnTallies,
  committeeSource,
  parseCommitteeWorkbook,
  resolveCommitteeAccess,
} from './logic';

describe('committee access', () => {
  it('is secretariat only unless set to everyone', () => {
    expect(resolveCommitteeAccess(null)).toBe('secretariat');
    expect(resolveCommitteeAccess('anything')).toBe('secretariat');
    expect(resolveCommitteeAccess('everyone')).toBe('everyone');
  });

  it('stores each committee under its own source', () => {
    expect(committeeSource('svc')).toBe('committee:svc');
  });
});

describe('reading a committee workbook', () => {
  it('finds the table under a title, trims it, and skips empty sheets', () => {
    const result = parseCommitteeWorkbook([
      {
        name: 'SVC 2026',
        rows: [
          ['Steering committee papers'],
          [],
          ['Ref', 'Paper', 'Decision', ''],
          ['SVC/01', ' Graduate intake ', 'Approved'],
          [],
          ['SVC/02', 'Pay review', 'Deferred', 'stray'],
        ],
      },
      { name: 'Notes', rows: [['Just one line of text']] },
      { name: 'Empty', rows: [] },
    ]);
    expect(result.skipped).toEqual(['Notes', 'Empty']);
    expect(result.kept).toEqual([
      {
        kind: 'table',
        name: 'SVC 2026',
        headers: ['Ref', 'Paper', 'Decision'],
        rows: [
          ['SVC/01', 'Graduate intake', 'Approved'],
          ['SVC/02', 'Pay review', 'Deferred'],
        ],
      },
    ]);
  });
});

describe('counting columns', () => {
  const headers = ['Ref', 'Paper', 'Decision', 'Note'];
  const rows = [
    ['1', 'A', 'Approved', ''],
    ['2', 'B', 'Approved', ''],
    ['3', 'C', 'Deferred', 'x'],
    ['4', 'D', 'Approved', ''],
    ['5', 'E', 'Noted', ''],
    ['6', 'F', 'Deferred', ''],
  ];

  it('counts category columns, most common first, and ignores the rest', () => {
    expect(columnTallies(headers, rows)).toEqual([
      {
        header: 'Decision',
        counts: [
          { value: 'Approved', count: 3 },
          { value: 'Deferred', count: 2 },
          { value: 'Noted', count: 1 },
        ],
      },
    ]);
  });

  it('says nothing about a table too small to summarise', () => {
    expect(columnTallies(headers, rows.slice(0, 2))).toEqual([]);
  });
});
