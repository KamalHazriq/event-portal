import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseAttendeeCsv } from './attendee-import';
import { parseCsv, parseCsvRecords } from './csv';

describe('parseCsv', () => {
  it('reads plain rows', () => {
    expect(parseCsv('a,b\n1,2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('keeps commas that are inside quotes', () => {
    expect(parseCsv('name,title\n"Tan, Mei Ling",Manager')).toEqual([
      ['name', 'title'],
      ['Tan, Mei Ling', 'Manager'],
    ]);
  });

  it('reads a doubled quote as one quote', () => {
    expect(parseCsv('note\n"she said ""yes"""')).toEqual([['note'], ['she said "yes"']]);
  });

  it('handles Windows line endings', () => {
    expect(parseCsv('a,b\r\n1,2\r\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('strips the byte order mark Excel adds', () => {
    expect(parseCsv('﻿no,name\n1,Someone')[0]).toEqual(['no', 'name']);
  });

  it('keeps empty cells rather than dropping them', () => {
    expect(parseCsv('a,b,c\n1,,3')).toEqual([
      ['a', 'b', 'c'],
      ['1', '', '3'],
    ]);
  });
});

describe('parseCsvRecords', () => {
  it('keys cells by column name', () => {
    expect(parseCsvRecords('no,name\n1,Someone')).toEqual([{ no: '1', name: 'Someone' }]);
  });

  it('accepts column names with capitals and spaces', () => {
    const records = parseCsvRecords('No,Staff No,Full Name\n1,D1,Someone');
    expect(records[0]).toEqual({ no: '1', staff_no: 'D1', full_name: 'Someone' });
  });

  it('ignores blank lines', () => {
    expect(parseCsvRecords('no,name\n1,A\n\n2,B\n')).toHaveLength(2);
  });
});

describe('parseAttendeeCsv', () => {
  it('reads the columns the brief specifies', () => {
    const result = parseAttendeeCsv(
      [
        'no,staff_no,name,title,department,remark',
        '7,D10007,Siti Osman,Senior Manager,Retail,Halal meal',
      ].join('\n'),
    );

    expect(result.problems).toEqual([]);
    expect(result.rows).toEqual([
      {
        no: 7,
        staffNo: 'D10007',
        name: 'Siti Osman',
        title: 'Senior Manager',
        department: 'Retail',
        remark: 'Halal meal',
        isSecretariat: false,
      },
    ]);
  });

  it('flags secretariat from the remark or the department', () => {
    const result = parseAttendeeCsv(
      [
        'no,staff_no,name,title,department,remark',
        '1,S90001,A Person,Registration Desk,Event Secretariat,Secretariat',
        '2,D10002,B Person,Manager,Retail,',
      ].join('\n'),
    );

    expect(result.rows[0]?.isSecretariat).toBe(true);
    expect(result.rows[1]?.isSecretariat).toBe(false);
  });

  it('reports the line number of a row with no staff number', () => {
    const result = parseAttendeeCsv(
      ['no,staff_no,name', '1,D1,Fine', '2,,Missing staff number'].join('\n'),
    );

    expect(result.rows).toHaveLength(1);
    expect(result.problems).toEqual([{ row: 3, reason: 'no staff_no' }]);
  });

  it('refuses a duplicate staff number and says which line it clashes with', () => {
    const result = parseAttendeeCsv(['no,staff_no,name', '1,D1,First', '2,D1,Second'].join('\n'));

    expect(result.rows).toHaveLength(1);
    expect(result.problems[0]?.row).toBe(3);
    expect(result.problems[0]?.reason).toContain('already used on line 2');
  });

  it('explains a missing header rather than importing nonsense', () => {
    const result = parseAttendeeCsv('name,department\nSomeone,Retail');
    expect(result.rows).toEqual([]);
    expect(result.problems[0]?.reason).toContain('staff_no');
  });

  it('leaves "no" null when the column is blank or not a number', () => {
    const result = parseAttendeeCsv(['no,staff_no,name', ',D1,A', 'x,D2,B'].join('\n'));
    expect(result.rows[0]?.no).toBeNull();
    expect(result.rows[1]?.no).toBeNull();
  });
});

describe('the dummy attendee list that ships with the repo', () => {
  const csv = readFileSync(join(process.cwd(), 'config', 'attendees.sample.csv'), 'utf8');
  const result = parseAttendeeCsv(csv);

  it('loads with no problems', () => {
    expect(result.problems).toEqual([]);
  });

  it('has 78 attendees and 12 secretariat, as in the brief', () => {
    const secretariat = result.rows.filter((row) => row.isSecretariat);
    expect(result.rows).toHaveLength(90);
    expect(secretariat).toHaveLength(12);
    expect(result.rows.length - secretariat.length).toBe(78);
  });

  it('gives everyone a unique staff number', () => {
    const staffNumbers = new Set(result.rows.map((row) => row.staffNo));
    expect(staffNumbers.size).toBe(result.rows.length);
  });

  it('gives everyone a name, a title and a department', () => {
    for (const row of result.rows) {
      expect(row.name.length).toBeGreaterThan(0);
      expect(row.title.length).toBeGreaterThan(0);
      expect(row.department.length).toBeGreaterThan(0);
    }
  });
});
