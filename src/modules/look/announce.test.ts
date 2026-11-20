import { describe, expect, it } from 'vitest';

import type { NowAndNext, ResolvedDay, ResolvedSession } from '@/modules/schedule/logic';

import { announcement } from './announce';

const session = (over: Partial<ResolvedSession>) =>
  ({
    id: 's',
    title: 'Talk',
    start: '10:00',
    end: '11:00',
    room: 'Hall',
    date: '2026-12-14',
    ...over,
  }) as ResolvedSession;
const day = {
  id: 'day-1',
  label: 'Day 1',
  date: '2026-12-14',
  sessions: [session({ id: 'reg', title: 'Arrival and registration', room: 'Classroom hall' })],
} as unknown as ResolvedDay;
const event = { name: 'Power Summit 2027', startDate: '2026-12-14', endDate: '2026-12-16' };
const f = { clock: (t: string) => t, shortDate: () => 'Mon 14 Dec' };
const base = {
  today: null,
  focusDay: day,
  live: [],
  next: null,
  minutesUntilNext: null,
} as unknown as NowAndNext;

describe('the announcement line', () => {
  it('before the event: when and where it starts, and how to check in', () => {
    const a = announcement(base, event, '2026-11-20', f);
    expect(a.strong).toBe('Day 1, Mon 14 Dec.');
    expect(a.text).toBe('Arrival and registration from 10:00 in the Classroom hall.');
    expect(a.link.href).toBe('/#how');
  });

  it('during a session: what is on now', () => {
    const a = announcement(
      { ...base, today: day, live: [session({ id: 'k', title: 'Keynote' })] },
      event,
      '2026-12-14',
      f,
    );
    expect(a.strong).toBe('Day 1, on now:');
    expect(a.text).toBe('Keynote, Hall.');
    expect(a.link.href).toBe('/session/k');
  });

  it('between sessions: what is next today', () => {
    const a = announcement(
      { ...base, today: day, next: session({ id: 'n', title: 'Lunch', start: '12:30' }) },
      event,
      '2026-12-14',
      f,
    );
    expect(a.text).toBe('Lunch at 12:30, Hall.');
  });

  it('after the event: thanks', () => {
    expect(announcement(base, event, '2026-12-17', f).strong).toMatch(/^Thank you/);
  });
});
