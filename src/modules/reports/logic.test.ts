import { describe, expect, it } from 'vitest';

import type { Attendee, CheckIn, FeedbackEntry, ImportedSheet } from '@/data/types';
import { getEventConfig } from '@/lib/config';
import { readXlsx } from '@/lib/xlsx/read';
import { writeXlsx } from '@/lib/xlsx/write';
import { EVENT_FORM_ID } from '@/modules/feedback/logic';

import {
  buildReportSummary,
  buildReportWorkbook,
  localClock,
  localDateTime,
  numberIfPlain,
  reportFileName,
  type ReportInput,
} from './logic';
import { classifySlidoSheet, findHeaderRow, parseSlidoWorkbook, slidoHighlights } from './slido';

const config = getEventConfig();

function person(id: string, department: string, isSecretariat = false): Attendee {
  return {
    id,
    no: null,
    staffNo: `S${id}`,
    name: `Person ${id}`,
    title: 'Manager',
    department,
    remark: 'Vegetarian meal',
    checkInToken: `secret-${id}`,
    isSecretariat,
    createdAt: '2026-11-01T00:00:00Z',
    updatedAt: '2026-11-01T00:00:00Z',
  };
}

function arrival(attendeeId: string, dayId: string, at: string): CheckIn {
  return {
    id: `${attendeeId}-${dayId}`,
    attendeeId,
    dayId,
    at,
    method: 'qr',
    byOperator: 'desk-1',
  };
}

function answer(
  formId: string,
  rating: number,
  answers: Record<string, string> = {},
  displayName = '',
): FeedbackEntry {
  return {
    id: `${formId}-${rating}-${Math.random()}`,
    formId,
    kind: formId === EVENT_FORM_ID ? 'event' : 'session',
    rating,
    answers,
    attendeeId: null,
    displayName,
    deviceId: 'd',
    at: '2026-12-14T08:00:00Z',
  };
}

function input(overrides: Partial<ReportInput> = {}): ReportInput {
  return {
    config,
    attendees: [
      person('a', 'Finance'),
      person('b', 'Finance'),
      person('c', 'Legal'),
      person('s', 'Secretariat', true),
    ],
    checkIns: [
      arrival('a', 'day-1', '2026-12-14T05:05:00Z'),
      arrival('s', 'day-1', '2026-12-14T04:00:00Z'),
      arrival('a', 'day-2', '2026-12-15T00:50:00Z'),
      arrival('c', 'day-2', '2026-12-15T01:00:00Z'),
      // Someone no longer on the list is ignored rather than counted.
      arrival('gone', 'day-2', '2026-12-15T01:00:00Z'),
    ],
    feedback: [
      answer('d1-keynote', 5, { comment: '=HYPERLINK("x")' }, 'Aina'),
      answer('d1-keynote', 3),
      answer(EVENT_FORM_ID, 4, { bestSessionId: 'd1-keynote', improve: 'Shorter' }),
    ],
    summaries: [],
    imports: [],
    generatedAt: new Date('2026-12-16T05:00:00Z'),
    ...overrides,
  };
}

describe('time in the event zone', () => {
  it('formats in Kuala Lumpur time, not the server zone', () => {
    expect(localClock('2026-12-14T05:05:00Z', 'Asia/Kuala_Lumpur')).toBe('13:05');
    expect(localDateTime('2026-12-14T17:30:00Z', 'Asia/Kuala_Lumpur')).toBe('2026-12-15 01:30');
  });

  it('names the file after the event and the local date', () => {
    expect(
      reportFileName('Power Summit', new Date('2026-12-16T17:00:00Z'), 'Asia/Kuala_Lumpur'),
    ).toBe('power-summit-report-2026-12-17.xlsx');
  });
});

describe('report summary', () => {
  const summary = buildReportSummary(input());

  it('counts arrivals per day, with and without the secretariat', () => {
    const [d1, d2] = summary.days;
    expect(d1).toMatchObject({ arrived: 2, expected: 4, guestsArrived: 1, guests: 3 });
    expect(d2).toMatchObject({ arrived: 2, guestsArrived: 2 });
    expect(summary.guestsAttendedAny).toBe(2);
  });

  it('breaks guests down by department and day', () => {
    expect(summary.byDepartment.find((d) => d.department === 'Finance')).toEqual({
      department: 'Finance',
      people: 2,
      perDay: [1, 1, 0],
    });
  });

  it('averages ratings and tallies the best session', () => {
    expect(summary.sessionAverage).toBe(4);
    expect(summary.eventAverage).toBe(4);
    expect(summary.sessions.find((s) => s.formId === 'd1-keynote')).toMatchObject({
      responses: 2,
      average: 4,
    });
    expect(summary.bestSessions[0]?.votes).toBe(1);
  });
});

describe('report workbook', () => {
  const sheets = buildReportWorkbook(input());
  const byName = new Map(sheets.map((s) => [s.name, s.rows]));

  it('has a sheet per topic', () => {
    expect(sheets.map((s) => s.name)).toEqual([
      'Summary',
      'Attendance',
      'Attendance by department',
      'Feedback',
      'Feedback by session',
      'Best session votes',
    ]);
  });

  it('lists everyone with local arrival times, and never the QR secret or the remark', () => {
    const rows = byName.get('Attendance') ?? [];
    const a = rows.find((r) => r[2] === 'Person a');
    expect(a).toEqual([
      null,
      'Sa',
      'Person a',
      'Manager',
      'Finance',
      'No',
      '13:05 (QR)',
      '08:50 (QR)',
      '',
      2,
    ]);
    expect(JSON.stringify(rows)).not.toContain('secret-');
    expect(JSON.stringify(rows)).not.toContain('Vegetarian');
  });

  it('shows names only where one was given', () => {
    const names = (byName.get('Feedback') ?? []).slice(1).map((r) => r[6]);
    expect(names.sort()).toEqual(['Aina', 'Anonymous', 'Anonymous']);
  });

  it('adds imported Slido sheets at the end', () => {
    const slido: ImportedSheet = {
      id: '1',
      source: 'slido',
      kind: 'polls',
      name: 'Polls',
      headers: ['Poll', 'Option', 'Votes'],
      rows: [['Q', 'A', '3']],
      fileName: 'slido.xlsx',
      byOperator: 'desk-1',
      importedAt: '2026-12-16T05:00:00Z',
    };
    const withSlido = buildReportWorkbook(input({ imports: [slido] }));
    expect(withSlido.at(-1)).toEqual({
      name: 'Slido Polls',
      rows: [
        ['Poll', 'Option', 'Votes'],
        ['Q', 'A', 3],
      ],
    });
  });

  it('writes a real file that reads back, with formula-looking text kept as text', () => {
    const back = readXlsx(writeXlsx(sheets));
    expect(back).toHaveLength(sheets.length);
    const feedback = back.find((s) => s.name === 'Feedback');
    expect(feedback?.rows.some((r) => r[3] === '=HYPERLINK("x")')).toBe(true);
  });
});

describe('Slido import', () => {
  it('classifies sheets by name, then by headers', () => {
    expect(classifySlidoSheet('Poll results', [])).toBe('polls');
    expect(classifySlidoSheet('Q&A', [])).toBe('questions');
    expect(classifySlidoSheet('Sheet1', ['Question', 'Likes'])).toBe('questions');
    expect(classifySlidoSheet('Sheet2', ['Option', 'Votes'])).toBe('polls');
    expect(classifySlidoSheet('Participants', ['Name', 'Email'])).toBeNull();
    expect(classifySlidoSheet('Sheet3', ['Name', 'E-mail', 'Votes'])).toBeNull();
  });

  it('finds the header under a title row', () => {
    expect(
      findHeaderRow([['Slido export'], [], ['Poll', 'Option', 'Votes'], ['a', 'b', '1']]),
    ).toBe(2);
    expect(findHeaderRow([[], []])).toBe(-1);
  });

  it('keeps polls and questions, and drops anything with personal details', () => {
    const result = parseSlidoWorkbook([
      {
        name: 'Poll results',
        rows: [
          ['Export'],
          ['Poll', 'Option', 'Votes', ''],
          ['How?', 'Very', '31'],
          [],
          ['', 'Fairly', '40'],
        ],
      },
      {
        name: 'Questions',
        rows: [
          ['Question', 'Author', 'Likes'],
          ['Who owns it?', 'Anonymous', '12'],
        ],
      },
      {
        name: 'Participants',
        rows: [
          ['Name', 'Email'],
          ['X', 'x@example.com'],
        ],
      },
    ]);
    expect(result.skipped).toEqual(['Participants']);
    expect(result.kept.map((k) => [k.kind, k.name])).toEqual([
      ['polls', 'Poll results'],
      ['questions', 'Questions'],
    ]);
    expect(result.kept[0]?.headers).toEqual(['Poll', 'Option', 'Votes']);
    expect(result.kept[0]?.rows).toEqual([
      ['How?', 'Very', '31'],
      ['', 'Fairly', '40'],
    ]);
  });

  it('picks out the most liked questions and each poll winner', () => {
    const h = slidoHighlights([
      {
        kind: 'polls',
        headers: ['Poll', 'Option', 'Votes'],
        rows: [
          ['How?', 'Very', '31'],
          ['', 'Fairly', '40'],
          ['Why?', 'Because', '5'],
        ],
      },
      {
        kind: 'questions',
        headers: ['Question', 'Likes'],
        rows: [
          ['A', '2'],
          ['B', '12'],
          ['C', 'x'],
        ],
      },
    ]);
    expect(h.pollWinners).toEqual([
      { poll: 'How?', option: 'Fairly', votes: 40 },
      { poll: 'Why?', option: 'Because', votes: 5 },
    ]);
    expect(h.topQuestions.map((q) => q.text)).toEqual(['B', 'A']);
    expect(h).toMatchObject({ pollSheets: 1, pollRows: 3, questionSheets: 1, questionRows: 3 });
  });
});

describe('numbers from Slido', () => {
  it('turns plain numbers back into numbers, and nothing else', () => {
    expect(['31', '0.4', '-2', '007', '1e5', '1,000', '', 'abc'].map(numberIfPlain)).toEqual([
      31,
      0.4,
      -2,
      '007',
      '1e5',
      '1,000',
      '',
      'abc',
    ]);
  });
});
