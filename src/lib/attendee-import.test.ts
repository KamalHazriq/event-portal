import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseAttendeeCsv, standInStaffNo } from './attendee-import';
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

  it('gives someone with no staff number a stand in made from their name', () => {
    const result = parseAttendeeCsv(
      ['no,staff_no,name', '1,D1,Fine', '2,,Pilot 1 Hj Example'].join('\n'),
    );

    expect(result.problems).toEqual([]);
    expect(result.rows[1]?.staffNo).toBe('EXT-PILOT-1-HJ-EXAMPLE');
    // The same every import, so re-importing updates rather than duplicates.
    expect(standInStaffNo('Pilot 1 Hj Example')).toBe(result.rows[1]?.staffNo);
  });

  it('reads the participant list layout: Role, Grade, Dept, and secretariat in Role', () => {
    const result = parseAttendeeCsv(
      [
        'No,Staff No,Name,Role,Grade,Dept,Remarks,Email',
        '1,D1,Person One,Lead,E16,TNS,,One@Example.com',
        '2,D2,Person Two,Secretariat,,SPTx,,',
        '3,,Pilot Three,Pilot,,Secretariat,External pilot,',
      ].join('\n'),
    );

    expect(result.problems).toEqual([]);
    expect(result.rows[0]).toMatchObject({
      title: 'Lead',
      department: 'TNS',
      email: 'one@example.com',
      isSecretariat: false,
    });
    expect(result.rows[1]).toMatchObject({ title: 'Secretariat', isSecretariat: true });
    expect(result.rows[1]).not.toHaveProperty('email');
    expect(result.rows[2]).toMatchObject({ staffNo: 'EXT-PILOT-THREE', isSecretariat: true });
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

  it('uses only the departments from the real participant list', () => {
    const real = ['CDOS', 'CSM', 'DDAI', 'D&I Div', 'GRC', 'EoTF', 'CCOO', 'TA', 'SPTx', 'CISO'];
    for (const row of result.rows) expect(real, row.name).toContain(row.department);
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

describe('the HR list export', () => {
  it('loads as it comes, with its own column names and a dated remarks column', () => {
    const csv = [
      'No,Holder,Complete Name,Position Text,Remarks (27Oct2026)',
      '1,10000001,Invented Person One,Head,',
      '2,10000002,Invented Person Two,Lead,"Team X, waiting confirmation"',
    ].join('\n');
    const { rows, problems } = parseAttendeeCsv(csv);
    expect(problems).toEqual([]);
    expect(rows).toEqual([
      {
        no: 1,
        staffNo: '10000001',
        name: 'Invented Person One',
        title: 'Head',
        department: '',
        remark: '',
        isSecretariat: false,
      },
      {
        no: 2,
        staffNo: '10000002',
        name: 'Invented Person Two',
        title: 'Lead',
        department: '',
        remark: 'Team X, waiting confirmation',
        isSecretariat: false,
      },
    ]);
  });

  it('names both spellings when the key columns are missing', () => {
    const { problems } = parseAttendeeCsv('No,Who,What\n1,a,b');
    expect(problems[0]?.reason).toContain('staff_no (or Holder)');
    expect(problems[0]?.reason).toContain('name (or Complete Name)');
  });
});
