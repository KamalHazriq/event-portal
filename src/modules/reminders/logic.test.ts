import { describe, expect, it } from 'vitest';

import { localDateTimeToInstant } from '@/lib/time';

import {
  dueReminders,
  isLocalDateTime,
  LATE_GRACE_MS,
  parseReminders,
  reminderStatus,
  secretMatches,
  sortReminders,
  type Reminder,
} from './logic';

const tz = 'Asia/Kuala_Lumpur';
const toInstant = (local: string) => localDateTimeToInstant(local, tz);
const reminder = (over: Partial<Reminder> = {}): Reminder => ({
  id: 'r1',
  at: '2026-12-14T07:00',
  text: 'Projector on, desks open',
  audience: 'team',
  ...over,
});
/** 07:00 in Kuala Lumpur is 23:00 UTC the evening before. */
const sevenAm = new Date('2026-12-13T23:00:00Z');

describe('reminders', () => {
  it('are due from their time, for a few hours, once', () => {
    const list = [reminder()];
    expect(dueReminders(list, new Date(sevenAm.getTime() - 60_000), toInstant)).toEqual([]);
    expect(dueReminders(list, sevenAm, toInstant)).toHaveLength(1);
    expect(dueReminders(list, new Date(sevenAm.getTime() + LATE_GRACE_MS), toInstant)).toHaveLength(
      1,
    );
    expect(dueReminders(list, new Date(sevenAm.getTime() + LATE_GRACE_MS + 1), toInstant)).toEqual(
      [],
    );
    expect(
      dueReminders([reminder({ sentAt: '2026-12-13T23:00:05Z' })], sevenAm, toInstant),
    ).toEqual([]);
  });

  it('say whether they are sent, waiting or missed', () => {
    const before = new Date(sevenAm.getTime() - 3_600_000);
    const way = new Date(sevenAm.getTime() + LATE_GRACE_MS + 60_000);
    expect(reminderStatus(reminder(), before, toInstant)).toBe('pending');
    expect(reminderStatus(reminder(), sevenAm, toInstant)).toBe('pending');
    expect(reminderStatus(reminder(), way, toInstant)).toBe('missed');
    expect(reminderStatus(reminder({ sentAt: 'x' }), way, toInstant)).toBe('sent');
  });

  it('read only well formed ones, and sort by time', () => {
    const raw = JSON.stringify([
      reminder({ id: 'b', at: '2026-12-15T08:00' }),
      { id: 'bad', at: 'tomorrow', text: 'x', audience: 'team' },
      { id: 'bad2', at: '2026-12-14T07:00', text: 'x', audience: 'all' },
      reminder({ id: 'a' }),
    ]);
    const list = parseReminders(raw);
    expect(sortReminders(list).map((r) => r.id)).toEqual(['a', 'b']);
    expect(parseReminders('nope')).toEqual([]);
    expect(parseReminders(null)).toEqual([]);
  });

  it('check the local date and time shape', () => {
    expect(isLocalDateTime('2026-12-14T07:00')).toBe(true);
    expect(isLocalDateTime('2026-12-14 07:00')).toBe(false);
    expect(isLocalDateTime('2026-12-14T25:00')).toBe(false);
  });

  it('need the right secret, and stay off with none set', () => {
    const eq = (a: string, b: string) => a === b;
    expect(secretMatches('s3cret', 's3cret', eq)).toBe(true);
    expect(secretMatches('s3cret', 'other', eq)).toBe(false);
    expect(secretMatches(undefined, 'anything', eq)).toBe(false);
    expect(secretMatches('', '', eq)).toBe(false);
    expect(secretMatches('s3cret', null, eq)).toBe(false);
  });
});
