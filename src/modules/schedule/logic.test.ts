import { describe, expect, it } from 'vitest';

import { EventConfigSchema, type EventConfig } from '@/lib/event-schema';
import type { EventNow } from '@/lib/time';

import {
  buildAgenda,
  findNowAndNext,
  formatMinutesUntil,
  resolveSelectedDay,
  sessionStatus,
  sessionTypeLabel,
} from './logic';

/* ------------------------------------------------------------- fixtures */

const THEME = {
  background: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceMuted: '#EEEEEE',
  border: '#CCCCCC',
  text: '#000000',
  textMuted: '#555555',
  primary: '#0053A1',
  primaryText: '#FFFFFF',
  accent: '#00A3E0',
  accentText: '#042C75',
  live: '#C2410C',
  success: '#1C7C4D',
  warning: '#A16207',
};

/** A two day event, with two parallel breakouts on day 2. */
function makeConfig(overrides: Partial<Record<string, unknown>> = {}): EventConfig {
  const base = {
    configVersion: 1,
    event: {
      name: 'Test Summit',
      shortName: 'Test',
      startDate: '2026-12-14',
      endDate: '2026-12-15',
      venue: 'Test Ballroom',
      timezone: 'Asia/Kuala_Lumpur',
      portalUrl: 'https://events.example.com/test',
    },
    branding: {
      brand: { primary: '#0053A1', navy: '#042C75', panel: '#E6EEF8' },
      themes: { light: THEME, dark: THEME },
    },
    integrations: {
      slido: { enabled: true, eventUrl: 'https://app.sli.do/event/test', eventCode: '#TEST' },
    },
    speakers: [{ id: 'sp-one', name: 'Speaker One' }],
    days: [
      {
        id: 'day-1',
        date: '2026-12-14',
        label: 'Day 1',
        sessions: [
          {
            id: 'd1-opening',
            start: '14:00',
            end: '15:00',
            title: 'Opening',
            type: 'talk',
            speakerIds: ['sp-one'],
          },
          { id: 'd1-break', start: '15:00', end: '15:30', title: 'Coffee', type: 'break' },
          { id: 'd1-dinner', start: '19:30', end: '21:00', title: 'Dinner', type: 'meal' },
        ],
      },
      {
        id: 'day-2',
        date: '2026-12-15',
        label: 'Day 2',
        sessions: [
          {
            id: 'd2-breakout-a',
            start: '10:30',
            end: '12:30',
            title: 'Breakout A',
            type: 'breakout',
          },
          {
            id: 'd2-breakout-b',
            start: '10:30',
            end: '12:30',
            title: 'Breakout B',
            type: 'breakout',
          },
          { id: 'd2-closing', start: '14:00', end: '15:00', title: 'Closing', type: 'talk' },
        ],
      },
    ],
    ...overrides,
  };

  return EventConfigSchema.parse(base);
}

const at = (date: string, clock: string): EventNow => {
  const [hours, minutes] = clock.split(':').map(Number);
  return { date, minutes: (hours ?? 0) * 60 + (minutes ?? 0), isOverride: false };
};

/* ---------------------------------------------------------------- tests */

describe('buildAgenda', () => {
  it('sorts days and sessions into time order', () => {
    const agenda = buildAgenda(makeConfig());

    expect(agenda.days.map((day) => day.id)).toEqual(['day-1', 'day-2']);
    expect(agenda.sessions.map((session) => session.id)).toEqual([
      'd1-opening',
      'd1-break',
      'd1-dinner',
      'd2-breakout-a',
      'd2-breakout-b',
      'd2-closing',
    ]);
  });

  it('attaches the day, the minute offsets and the full speaker records', () => {
    const agenda = buildAgenda(makeConfig());
    const opening = agenda.byId.get('d1-opening');

    expect(opening?.dayId).toBe('day-1');
    expect(opening?.date).toBe('2026-12-14');
    expect(opening?.startMinutes).toBe(840);
    expect(opening?.endMinutes).toBe(900);
    expect(opening?.speakers.map((speaker) => speaker.name)).toEqual(['Speaker One']);
  });

  it('falls back to the event wide Slido link when a session has none', () => {
    const agenda = buildAgenda(makeConfig());
    expect(agenda.byId.get('d1-opening')?.slidoLink?.eventCode).toBe('#TEST');
  });

  it('lets a session override the event wide Slido link', () => {
    const config = makeConfig();
    const firstDay = config.days[0];
    const firstSession = firstDay?.sessions[0];
    if (!firstSession) throw new Error('fixture is missing a session');
    firstSession.slido = { eventUrl: 'https://app.sli.do/event/other', label: 'Join Slido' };

    const agenda = buildAgenda(config);
    expect(agenda.byId.get('d1-opening')?.slidoLink?.eventUrl).toBe(
      'https://app.sli.do/event/other',
    );
  });

  it('gives no Slido link when the integration is switched off', () => {
    const agenda = buildAgenda(makeConfig({ integrations: {} }));
    expect(agenda.byId.get('d1-opening')?.slidoLink).toBeNull();
  });

  it('keeps hidden sessions out of the lists but reachable by id', () => {
    const config = makeConfig();
    const session = config.days[0]?.sessions[1];
    if (!session) throw new Error('fixture is missing a session');
    session.hidden = true;

    const agenda = buildAgenda(config);
    expect(agenda.sessions.map((s) => s.id)).not.toContain('d1-break');
    expect(agenda.days[0]?.sessions.map((s) => s.id)).not.toContain('d1-break');
    expect(agenda.byId.get('d1-break')?.title).toBe('Coffee');
  });
});

describe('sessionStatus', () => {
  const session = { date: '2026-12-14', startMinutes: 840, endMinutes: 900 };

  it('is upcoming before the start', () => {
    expect(sessionStatus(session, at('2026-12-14', '13:59'))).toBe('upcoming');
  });

  it('is live exactly on the start minute', () => {
    expect(sessionStatus(session, at('2026-12-14', '14:00'))).toBe('live');
  });

  it('is live in the middle', () => {
    expect(sessionStatus(session, at('2026-12-14', '14:30'))).toBe('live');
  });

  it('is past exactly on the end minute, not live', () => {
    expect(sessionStatus(session, at('2026-12-14', '15:00'))).toBe('past');
  });

  it('is upcoming on an earlier date, whatever the clock says', () => {
    expect(sessionStatus(session, at('2026-12-13', '23:59'))).toBe('upcoming');
  });

  it('is past on a later date, whatever the clock says', () => {
    expect(sessionStatus(session, at('2026-12-15', '00:01'))).toBe('past');
  });
});

describe('findNowAndNext', () => {
  const agenda = buildAgenda(makeConfig());

  it('shows the first session as next before the event begins', () => {
    const result = findNowAndNext(agenda, at('2026-11-04', '09:00'));

    expect(result.beforeEventStarts).toBe(true);
    expect(result.afterEventEnds).toBe(false);
    expect(result.live).toEqual([]);
    expect(result.next?.id).toBe('d1-opening');
    expect(result.today).toBeNull();
    // The page still has something to show.
    expect(result.focusDay?.id).toBe('day-1');
    // Next is on another date, so a countdown in minutes makes no sense.
    expect(result.minutesUntilNext).toBeNull();
  });

  it('finds the live session and the one after it', () => {
    const result = findNowAndNext(agenda, at('2026-12-14', '14:30'));

    expect(result.live.map((session) => session.id)).toEqual(['d1-opening']);
    expect(result.next?.id).toBe('d1-break');
    expect(result.minutesUntilNext).toBe(30);
    expect(result.today?.id).toBe('day-1');
  });

  it('shows nothing live in a gap, and still points at the next session', () => {
    const result = findNowAndNext(agenda, at('2026-12-14', '17:00'));

    expect(result.live).toEqual([]);
    expect(result.next?.id).toBe('d1-dinner');
    expect(result.minutesUntilNext).toBe(150);
  });

  it('crosses into the next day once today is finished', () => {
    const result = findNowAndNext(agenda, at('2026-12-14', '23:00'));

    expect(result.live).toEqual([]);
    expect(result.next?.id).toBe('d2-breakout-a');
    expect(result.today?.id).toBe('day-1');
    expect(result.minutesUntilNext).toBeNull();
    expect(result.afterEventEnds).toBe(false);
  });

  it('reports both parallel breakouts as live at the same time', () => {
    const result = findNowAndNext(agenda, at('2026-12-15', '11:00'));

    expect(result.live.map((session) => session.id)).toEqual(['d2-breakout-a', 'd2-breakout-b']);
    expect(result.next?.id).toBe('d2-closing');
  });

  it('knows when the event is over', () => {
    const result = findNowAndNext(agenda, at('2026-12-15', '15:00'));

    expect(result.afterEventEnds).toBe(true);
    expect(result.live).toEqual([]);
    expect(result.next).toBeNull();
    expect(result.focusDay?.id).toBe('day-2');
  });
});

describe('resolveSelectedDay', () => {
  const agenda = buildAgenda(makeConfig());

  it('uses the requested day when it exists', () => {
    expect(resolveSelectedDay(agenda, 'day-2', at('2026-12-14', '14:00'))?.id).toBe('day-2');
  });

  it('falls back to today when the requested day is unknown', () => {
    expect(resolveSelectedDay(agenda, 'day-9', at('2026-12-14', '14:00'))?.id).toBe('day-1');
  });

  it('falls back to today when nothing is requested', () => {
    expect(resolveSelectedDay(agenda, null, at('2026-12-15', '09:00'))?.id).toBe('day-2');
  });
});

describe('labels', () => {
  it('names every session type in plain English', () => {
    expect(sessionTypeLabel('talk')).toBe('Talk');
    expect(sessionTypeLabel('breakout')).toBe('Breakout');
    expect(sessionTypeLabel('meal')).toBe('Meal');
    expect(sessionTypeLabel('logistics')).toBe('Logistics');
  });

  it('counts down in words', () => {
    expect(formatMinutesUntil(0)).toBe('now');
    expect(formatMinutesUntil(1)).toBe('in 1 minute');
    expect(formatMinutesUntil(25)).toBe('in 25 minutes');
    expect(formatMinutesUntil(60)).toBe('in 1 hour');
    expect(formatMinutesUntil(70)).toBe('in 1 hour 10 minutes');
    expect(formatMinutesUntil(125)).toBe('in 2 hours 5 minutes');
  });

  it('uses no em dashes, per the brief', () => {
    const samples = [sessionTypeLabel('talk'), formatMinutesUntil(70), formatMinutesUntil(0)].join(
      ' ',
    );
    expect(samples).not.toMatch(/[—–]/);
  });
});
