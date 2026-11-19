import { describe, expect, it } from 'vitest';

import type { Attendee, CheckIn, Photo } from '@/data/types';
import { getEventConfig } from '@/lib/config';
import { toMinutes } from '@/lib/time';

import {
  arrivalBuckets,
  buildAlerts,
  engagementBySession,
  eventPhase,
  peakBucket,
  phonesTakingPart,
  type InsightsInput,
} from './logic';

const config = getEventConfig();
const at = (date: string, clock: string) => ({
  date,
  minutes: toMinutes(clock),
  isOverride: true,
});

function person(id: string, department: string, isSecretariat = false): Attendee {
  return {
    id,
    no: null,
    staffNo: `S${id}`,
    name: `Person ${id}`,
    title: '',
    department,
    remark: '',
    email: '',
    checkInToken: `t-${id}`,
    isSecretariat,
    createdAt: '2026-11-01T00:00:00Z',
    updatedAt: '2026-11-01T00:00:00Z',
  };
}

/** Kuala Lumpur is UTC+8, so 12:05 local is 04:05Z. */
function arrival(attendeeId: string, dayId: string, utc: string): CheckIn {
  return {
    id: `${attendeeId}-${dayId}`,
    attendeeId,
    dayId,
    at: utc,
    method: 'qr',
    byOperator: 'd',
  };
}

function input(over: Partial<InsightsInput> = {}): InsightsInput {
  return {
    config,
    attendees: [],
    checkIns: [],
    feedback: [],
    photos: [],
    reactions: [],
    comments: [],
    links: [],
    photosModerated: true,
    now: at('2026-12-01', '10:00'),
    ...over,
  };
}

describe('eventPhase', () => {
  it('is before, during, then after the last session', () => {
    expect(eventPhase(config, at('2026-12-13', '23:00'))).toBe('before');
    expect(eventPhase(config, at('2026-12-14', '09:00'))).toBe('during');
    expect(eventPhase(config, at('2026-12-16', '11:59'))).toBe('during');
    expect(eventPhase(config, at('2026-12-16', '12:01'))).toBe('after');
  });
});

describe('arrivals', () => {
  it('counts per quarter hour in the event time zone, keeping gaps', () => {
    const buckets = arrivalBuckets(
      [
        { at: '2026-12-14T04:01:00Z' },
        { at: '2026-12-14T04:14:00Z' },
        { at: '2026-12-14T04:50:00Z' },
      ],
      'Asia/Kuala_Lumpur',
    );
    expect(buckets).toEqual([
      { start: '12:00', end: '12:15', count: 2 },
      { start: '12:15', end: '12:30', count: 0 },
      { start: '12:30', end: '12:45', count: 0 },
      { start: '12:45', end: '13:00', count: 1 },
    ]);
    expect(peakBucket(buckets)?.start).toBe('12:00');
    expect(peakBucket([])).toBeNull();
  });
});

describe('alerts', () => {
  it('asks for the list first', () => {
    const alerts = buildAlerts(input());
    expect(alerts[0]).toMatchObject({ tone: 'act', href: '/admin/attendees' });
  });

  it('flags guests not in yet, half an hour after the start', () => {
    const attendees = Array.from({ length: 10 }, (_, i) => person(`p${i}`, 'Ops'));
    const checkIns = [arrival('p0', 'day-1', '2026-12-14T04:30:00Z')];
    const early = buildAlerts(input({ attendees, checkIns, now: at('2026-12-14', '13:20') }));
    expect(early.some((a) => a.href === '/admin/headcount')).toBe(false);
    const late = buildAlerts(input({ attendees, checkIns, now: at('2026-12-14', '13:40') }));
    expect(late.find((a) => a.href === '/admin/headcount')?.text).toBe(
      '9 of 10 guests are not checked in yet today.',
    );
  });

  it('names a department with nobody in', () => {
    const attendees = [
      ...Array.from({ length: 12 }, (_, i) => person(`a${i}`, 'Ops')),
      person('b1', 'Cyber'),
    ];
    const checkIns = attendees
      .filter((a) => a.department === 'Ops')
      .map((a) => arrival(a.id, 'day-1', '2026-12-14T04:30:00Z'));
    const alerts = buildAlerts(input({ attendees, checkIns, now: at('2026-12-14', '14:00') }));
    expect(alerts.some((a) => a.text === 'Nobody from Cyber has checked in today.')).toBe(true);
    expect(alerts.some((a) => a.text.startsWith('Busiest arrivals today: 12 people'))).toBe(true);
  });

  it('says when few phones have alerts on', () => {
    const attendees = Array.from({ length: 30 }, (_, i) => person(`g${i}`, 'Ops'));
    const checkIns = attendees.map((a) => arrival(a.id, 'day-1', '2026-12-14T04:30:00Z'));
    const few = buildAlerts(
      input({ attendees, checkIns, alertPhones: 3, now: at('2026-12-14', '14:00') }),
    );
    expect(few.some((a) => a.text.startsWith('Only 3 phones have event alerts on'))).toBe(true);
    const plenty = buildAlerts(
      input({ attendees, checkIns, alertPhones: 20, now: at('2026-12-14', '14:00') }),
    );
    expect(plenty.some((a) => a.text.includes('event alerts on'))).toBe(false);
  });

  it('suggests turning approval off when many photos wait', () => {
    const photos = Array.from({ length: 10 }, (_, i): Photo => ({
      id: `ph${i}`,
      deviceId: `d${i}`,
      caption: '',
      status: 'pending',
      width: 1,
      height: 1,
      sizeBytes: 1,
      createdAt: '2026-12-14T05:00:00Z',
      reviewedAt: null,
      reviewedBy: '',
    }));
    const alert = buildAlerts(input({ photos })).find((a) => a.href === '/admin/photos');
    expect(alert?.text).toContain('turn approval off');
  });

  it('puts things to do before notes and good news', () => {
    const tones = buildAlerts(
      input({ attendees: [person('x', '')], now: at('2026-12-14', '14:00') }),
    ).map((a) => a.tone);
    expect(tones).toEqual(
      [...tones].sort(
        (a, b) => ['act', 'note', 'good'].indexOf(a) - ['act', 'note', 'good'].indexOf(b),
      ),
    );
  });
});

describe('engagement', () => {
  it('counts phones once per session, and every phone that took part', () => {
    const reactions = [
      { sessionId: 'd1-keynote', deviceId: 'a' },
      { sessionId: 'd1-keynote', deviceId: 'a' },
      { sessionId: 'd1-keynote', deviceId: 'b' },
    ];
    const rows = engagementBySession(input({ reactions }));
    expect(rows.find((r) => r.sessionId === 'd1-keynote')?.reactors).toBe(2);
    const breaks = config.days.flatMap((d) => d.sessions).filter((s) => s.type === 'break');
    expect(rows.some((r) => breaks.some((b) => b.id === r.sessionId))).toBe(false);
    expect(phonesTakingPart(input({ reactions }))).toBe(2);
  });
});
