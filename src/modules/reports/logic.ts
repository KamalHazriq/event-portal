/**
 * Module 7: the event report.
 *
 * Builds the Excel workbook and the numbers for the printable summary from
 * what is stored. No AI, just tables, counts and averages, as the brief
 * asks. Pure functions, see logic.test.ts.
 */
import type {
  Attendee,
  CheckIn,
  FeedbackEntry,
  FeedbackSummary,
  ImportedSheet,
  LuckyDrawWinnerWithAttendee,
} from '@/data/types';
import type { EventConfig } from '@/lib/event-schema';
import { formatShortDate } from '@/lib/time';
import type { CellValue, SheetInput } from '@/lib/xlsx/write';
import { EVENT_FORM_ID, feedbackForms, tallyBestSessions } from '@/modules/feedback/logic';

export type ReportInput = {
  config: EventConfig;
  attendees: Attendee[];
  /** Every check in, all days. */
  checkIns: CheckIn[];
  feedback: FeedbackEntry[];
  summaries: FeedbackSummary[];
  imports: ImportedSheet[];
  /** Lucky draw winners, in draw order. */
  luckyDraw: LuckyDrawWinnerWithAttendee[];
  /** Photo wall counts. Only counts: the photos are in their own zip. */
  photos?: { approved: number; total: number };
  /** When the report was made, as an instant. */
  generatedAt: Date;
};

const METHOD_LABEL: Record<CheckIn['method'], string> = {
  qr: 'QR',
  manual: 'Name search',
  admin: 'Admin',
};

/** "14:05" in the event's time zone. */
export function localClock(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(iso));
}

/** "2026-12-14 14:05" in the event's time zone. Sorts correctly as text. */
export function localDateTime(iso: string, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}`;
}

export function reportFileName(
  shortName: string,
  generatedAt: Date,
  timezone: string,
  ext = 'xlsx',
): string {
  const slug =
    shortName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'event';
  const date = localDateTime(generatedAt.toISOString(), timezone).slice(0, 10);
  return `${slug}-report-${date}.${ext}`;
}

/* ---------------------------------------------------------------- numbers */

export type DayAttendance = {
  dayId: string;
  label: string;
  date: string;
  arrived: number;
  expected: number;
  guestsArrived: number;
  guests: number;
};

export type ReportSummary = {
  days: DayAttendance[];
  /** People who came on at least one day, guests only. */
  guestsAttendedAny: number;
  guests: number;
  secretariat: number;
  byDepartment: { department: string; people: number; perDay: number[] }[];
  feedbackAnswers: number;
  /** Average of every session star rating, across all session forms. */
  sessionAverage: number | null;
  eventAverage: number | null;
  eventAnswers: number;
  sessions: {
    formId: string;
    title: string;
    when: string;
    responses: number;
    average: number | null;
  }[];
  bestSessions: { title: string; votes: number }[];
  luckyDrawWinners: number;
  luckyDrawDraws: number;
};

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 10) / 10;
}

function sortedDays(config: EventConfig) {
  return [...config.days].sort((a, b) => (a.date < b.date ? -1 : 1));
}

export function buildReportSummary(input: ReportInput): ReportSummary {
  const { config, attendees, checkIns, feedback } = input;
  const tz = config.event.timezone;
  const days = sortedDays(config);
  const known = new Map(attendees.map((a) => [a.id, a]));
  const guests = attendees.filter((a) => !a.isSecretariat);

  const byDay = new Map<string, Set<string>>();
  for (const c of checkIns) {
    if (!known.has(c.attendeeId)) continue;
    const set = byDay.get(c.dayId) ?? new Set<string>();
    set.add(c.attendeeId);
    byDay.set(c.dayId, set);
  }

  const dayRows: DayAttendance[] = days.map((day) => {
    const ids = byDay.get(day.id) ?? new Set<string>();
    return {
      dayId: day.id,
      label: day.label,
      date: formatShortDate(day.date, tz),
      arrived: ids.size,
      expected: attendees.length,
      guestsArrived: [...ids].filter((id) => !known.get(id)?.isSecretariat).length,
      guests: guests.length,
    };
  });

  const attendedAny = new Set([...byDay.values()].flatMap((s) => [...s]));

  const departments = [...new Set(guests.map((a) => a.department || 'No department'))].sort();
  const byDepartment = departments.map((department) => {
    const people = guests.filter((a) => (a.department || 'No department') === department);
    return {
      department,
      people: people.length,
      perDay: days.map((day) => people.filter((p) => byDay.get(day.id)?.has(p.id)).length),
    };
  });

  const forms = feedbackForms(config);
  const titles = new Map(forms.map((f) => [f.id, f.title]));
  const sessionRatings = feedback
    .filter((f) => f.kind === 'session' && f.rating !== null)
    .map((f) => f.rating as number);
  const eventEntries = feedback.filter((f) => f.formId === EVENT_FORM_ID);

  const sessions = forms
    .filter((f) => f.kind === 'session')
    .map((form) => {
      const ratings = feedback
        .filter((f) => f.formId === form.id && f.rating !== null)
        .map((f) => f.rating as number);
      return {
        formId: form.id,
        title: form.title,
        when: form.context,
        responses: feedback.filter((f) => f.formId === form.id).length,
        average: average(ratings),
      };
    });

  const sessionTitles = new Map<string, string>();
  for (const day of config.days) for (const s of day.sessions) sessionTitles.set(s.id, s.title);

  return {
    days: dayRows,
    guestsAttendedAny: [...attendedAny].filter((id) => !known.get(id)?.isSecretariat).length,
    guests: guests.length,
    secretariat: attendees.length - guests.length,
    byDepartment,
    feedbackAnswers: feedback.length,
    sessionAverage: average(sessionRatings),
    eventAverage: average(
      eventEntries.filter((f) => f.rating !== null).map((f) => f.rating as number),
    ),
    eventAnswers: eventEntries.length,
    sessions,
    luckyDrawWinners: input.luckyDraw.length,
    luckyDrawDraws: new Set(input.luckyDraw.map((w) => w.drawId)).size,
    bestSessions: tallyBestSessions(eventEntries).map((b) => ({
      title: sessionTitles.get(b.sessionId) ?? titles.get(b.sessionId) ?? b.sessionId,
      votes: b.votes,
    })),
  };
}

/* --------------------------------------------------------------- workbook */

/**
 * Turns "31" or "0.4" back into a number so Excel can sum it. Leaves alone
 * anything where that would lose information, such as "007" or "1e5".
 */
export function numberIfPlain(value: string): string | number {
  return /^-?(0|[1-9]\d{0,14})(\.\d+)?$/.test(value) ? Number(value) : value;
}

export function buildReportWorkbook(input: ReportInput): SheetInput[] {
  const { config, attendees, checkIns, feedback, imports } = input;
  const tz = config.event.timezone;
  const days = sortedDays(config);
  const summary = buildReportSummary(input);
  const forms = new Map(feedbackForms(config).map((f) => [f.id, f]));
  const sessionTitles = new Map<string, string>();
  for (const day of config.days) for (const s of day.sessions) sessionTitles.set(s.id, s.title);

  /* Summary */
  const pct = (a: number, b: number) => (b === 0 ? '' : `${Math.round((a / b) * 100)}%`);
  const summaryRows: CellValue[][] = [
    ['Item', 'Value'],
    ['Event', config.event.name],
    ['Venue', config.event.venue],
    ['Report made', localDateTime(input.generatedAt.toISOString(), tz)],
    ['Guests on the list', summary.guests],
    ['Secretariat on the list', summary.secretariat],
    ['Guests who came on at least one day', summary.guestsAttendedAny],
    ...summary.days.map((d): CellValue[] => [
      `${d.label}, ${d.date}`,
      `${d.guestsArrived} of ${d.guests} guests (${pct(d.guestsArrived, d.guests)}), ${d.arrived} of ${d.expected} including secretariat`,
    ]),
    ['Feedback answers', summary.feedbackAnswers],
    ['Average session rating', summary.sessionAverage ?? 'No ratings'],
    ['Average event rating', summary.eventAverage ?? 'No ratings'],
    ...(input.photos
      ? [
          [
            'Photo wall',
            `${input.photos.approved} approved of ${input.photos.total} shared`,
          ] as CellValue[],
        ]
      : []),
    ['Lucky draw winners', `${summary.luckyDrawWinners} across ${summary.luckyDrawDraws} draws`],
    [
      'Slido results',
      imports.length > 0
        ? `${imports[0]?.fileName}, imported ${localDateTime(imports[0]?.importedAt ?? '', tz)}`
        : 'Not imported',
    ],
  ];

  /* Attendance, one row per person */
  const checkInByKey = new Map(checkIns.map((c) => [`${c.attendeeId}:${c.dayId}`, c]));
  const attendanceRows: CellValue[][] = [
    [
      'No',
      'Staff no',
      'Name',
      'Title',
      'Department',
      'Secretariat',
      ...days.map((d) => `${d.label} arrived`),
      'Days attended',
    ],
    ...attendees.map((a): CellValue[] => {
      const perDay = days.map((d) => {
        const c = checkInByKey.get(`${a.id}:${d.id}`);
        return c ? `${localClock(c.at, tz)} (${METHOD_LABEL[c.method] ?? c.method})` : '';
      });
      return [
        a.no,
        a.staffNo,
        a.name,
        a.title,
        a.department,
        a.isSecretariat ? 'Yes' : 'No',
        ...perDay,
        perDay.filter(Boolean).length,
      ];
    }),
  ];

  /* By department */
  const departmentRows: CellValue[][] = [
    ['Department', 'Guests', ...days.map((d) => `${d.label} arrived`)],
    ...summary.byDepartment.map((d): CellValue[] => [d.department, d.people, ...d.perDay]),
  ];

  /* Feedback, every answer */
  const feedbackRows: CellValue[][] = [
    ['Form', 'When', 'Stars', 'Comment', 'One thing to improve', 'Best session', 'Name', 'Sent'],
    ...[...feedback]
      .sort((a, b) => (a.at < b.at ? -1 : 1))
      .map((f): CellValue[] => {
        const form = forms.get(f.formId);
        return [
          form?.title ?? f.formId,
          form?.context ?? '',
          f.rating,
          f.answers.comment ?? '',
          f.answers.improve ?? '',
          f.answers.bestSessionId ? (sessionTitles.get(f.answers.bestSessionId) ?? '') : '',
          // The form's anonymity setting decided this when it was sent.
          f.displayName || 'Anonymous',
          localDateTime(f.at, tz),
        ];
      }),
  ];

  /* Feedback per session */
  const counts = new Map(input.summaries.map((s) => [s.formId, s.ratingCounts]));
  const perSessionRows: CellValue[][] = [
    [
      'Session',
      'When',
      'Answers',
      'Average stars',
      '5 stars',
      '4 stars',
      '3 stars',
      '2 stars',
      '1 star',
    ],
    ...summary.sessions.map((s): CellValue[] => {
      const c = counts.get(s.formId);
      return [
        s.title,
        s.when,
        s.responses,
        s.average,
        c?.[5] ?? 0,
        c?.[4] ?? 0,
        c?.[3] ?? 0,
        c?.[2] ?? 0,
        c?.[1] ?? 0,
      ];
    }),
  ];

  const sheets: SheetInput[] = [
    { name: 'Summary', rows: summaryRows },
    { name: 'Attendance', rows: attendanceRows },
    { name: 'Attendance by department', rows: departmentRows },
    { name: 'Feedback', rows: feedbackRows },
    { name: 'Feedback by session', rows: perSessionRows },
  ];

  if (summary.bestSessions.length > 0) {
    sheets.push({
      name: 'Best session votes',
      rows: [
        ['Session', 'Votes'],
        ...summary.bestSessions.map((b): CellValue[] => [b.title, b.votes]),
      ],
    });
  }

  if (input.luckyDraw.length > 0) {
    const drawNumbers = new Map<string, number>();
    for (const w of input.luckyDraw) {
      if (!drawNumbers.has(w.drawId)) drawNumbers.set(w.drawId, drawNumbers.size + 1);
    }
    sheets.push({
      name: 'Lucky draw',
      rows: [
        ['Draw', 'Prize', 'Order', 'Name', 'Department', 'Drawn', 'By'],
        ...input.luckyDraw.map((w): CellValue[] => [
          drawNumbers.get(w.drawId) ?? null,
          w.prize,
          w.position,
          w.attendee.name,
          w.attendee.department,
          localDateTime(w.drawnAt, tz),
          w.byOperator,
        ]),
      ],
    });
  }

  for (const sheet of imports) {
    sheets.push({
      name: `Slido ${sheet.name}`,
      rows: [sheet.headers, ...sheet.rows.map((row) => row.map(numberIfPlain))],
    });
  }

  return sheets;
}
