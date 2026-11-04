import { afterEach, describe, expect, it } from 'vitest';

import {
  compareMoments,
  formatClock,
  formatLongDate,
  formatTimeRange,
  fromMinutes,
  localDateTimeToInstant,
  parseTimeOverride,
  resolveEventNow,
  toMinutes,
  wallClockInZone,
} from './time';

const KL = 'Asia/Kuala_Lumpur';

afterEach(() => {
  delete process.env.DEV_FAKE_NOW;
});

describe('toMinutes and fromMinutes', () => {
  it('converts a 24 hour time to minutes since midnight', () => {
    expect(toMinutes('00:00')).toBe(0);
    expect(toMinutes('09:00')).toBe(540);
    expect(toMinutes('14:30')).toBe(870);
    expect(toMinutes('23:59')).toBe(1439);
  });

  it('returns NaN for anything that is not a time', () => {
    expect(toMinutes('24:00')).toBeNaN();
    expect(toMinutes('9:00')).toBeNaN();
    expect(toMinutes('')).toBeNaN();
    expect(toMinutes('lunch')).toBeNaN();
  });

  it('round trips', () => {
    expect(fromMinutes(toMinutes('14:30'))).toBe('14:30');
    expect(fromMinutes(0)).toBe('00:00');
  });
});

describe('formatting', () => {
  it('writes times the way people say them', () => {
    expect(formatClock('09:00')).toBe('9:00 am');
    expect(formatClock('12:00')).toBe('12:00 pm');
    expect(formatClock('12:30')).toBe('12:30 pm');
    expect(formatClock('00:15')).toBe('12:15 am');
    expect(formatClock('14:30')).toBe('2:30 pm');
    expect(formatClock('21:00')).toBe('9:00 pm');
  });

  it('writes a range with the word "to", not a dash', () => {
    expect(formatTimeRange('09:00', '10:30')).toBe('9:00 am to 10:30 am');
    expect(formatTimeRange('13:00', '14:00')).not.toMatch(/[-–—]/);
  });

  it('writes the long date for Day 1 of the summit', () => {
    expect(formatLongDate('2026-12-14', KL)).toBe('Monday 14 December 2026');
  });
});

describe('wallClockInZone', () => {
  it('reads the clock in Kuala Lumpur, which is UTC plus 8', () => {
    // 2026-12-14 06:30 UTC is 14:30 the same day in Kuala Lumpur.
    const result = wallClockInZone(KL, new Date('2026-12-14T06:30:00Z'));
    expect(result.date).toBe('2026-12-14');
    expect(result.minutes).toBe(870);
  });

  it('rolls over to the next local date late in the UTC evening', () => {
    // 2026-12-14 17:00 UTC is already 01:00 on the 15th in Kuala Lumpur.
    const result = wallClockInZone(KL, new Date('2026-12-14T17:00:00Z'));
    expect(result.date).toBe('2026-12-15');
    expect(result.minutes).toBe(60);
  });

  it('does not follow the server time zone', () => {
    const utc = wallClockInZone('UTC', new Date('2026-12-14T06:30:00Z'));
    const kl = wallClockInZone(KL, new Date('2026-12-14T06:30:00Z'));
    expect(kl.minutes - utc.minutes).toBe(480);
  });
});

describe('the dev time override', () => {
  it('reads a date and time', () => {
    expect(parseTimeOverride('2026-12-14T14:30')).toEqual({
      date: '2026-12-14',
      minutes: 870,
      isOverride: true,
    });
  });

  it('ignores anything that is not a date and time', () => {
    expect(parseTimeOverride(null)).toBeNull();
    expect(parseTimeOverride('')).toBeNull();
    expect(parseTimeOverride('2026-12-14')).toBeNull();
    expect(parseTimeOverride('tomorrow')).toBeNull();
    expect(parseTimeOverride('2026-12-14T99:99')).toBeNull();
  });

  it('prefers the URL parameter over the environment variable', () => {
    process.env.DEV_FAKE_NOW = '2026-12-16T09:00';
    const now = resolveEventNow({ timezone: KL, overrideParam: '2026-12-14T14:30' });
    expect(now.date).toBe('2026-12-14');
    expect(now.minutes).toBe(870);
    expect(now.isOverride).toBe(true);
  });

  it('falls back to the environment variable', () => {
    process.env.DEV_FAKE_NOW = '2026-12-16T09:00';
    const now = resolveEventNow({ timezone: KL, overrideParam: null });
    expect(now.date).toBe('2026-12-16');
    expect(now.minutes).toBe(540);
    expect(now.isOverride).toBe(true);
  });

  it('uses the real clock when nothing is set', () => {
    const now = resolveEventNow({
      timezone: KL,
      overrideParam: null,
      at: new Date('2026-12-15T02:00:00Z'),
    });
    expect(now.date).toBe('2026-12-15');
    expect(now.minutes).toBe(600);
    expect(now.isOverride).toBe(false);
  });
});

describe('compareMoments', () => {
  it('orders by date first, then by clock', () => {
    const a = { date: '2026-12-14', minutes: 900 };
    const b = { date: '2026-12-15', minutes: 60 };
    expect(compareMoments(a, b)).toBeLessThan(0);
    expect(compareMoments(b, a)).toBeGreaterThan(0);
    expect(compareMoments(a, { ...a })).toBe(0);
  });
});

describe('localDateTimeToInstant', () => {
  it('turns an event local time into the right instant', () => {
    // 20:30 in Kuala Lumpur is 12:30 UTC.
    const instant = localDateTimeToInstant('2026-12-15T20:30', KL);
    expect(instant?.toISOString()).toBe('2026-12-15T12:30:00.000Z');
  });

  it('works for a time zone behind UTC', () => {
    const instant = localDateTimeToInstant('2026-12-15T09:00', 'America/New_York');
    expect(instant?.toISOString()).toBe('2026-12-15T14:00:00.000Z');
  });

  it('works for a half hour offset', () => {
    const instant = localDateTimeToInstant('2026-12-15T09:00', 'Asia/Kolkata');
    expect(instant?.toISOString()).toBe('2026-12-15T03:30:00.000Z');
  });

  it('returns null for a value it cannot read', () => {
    expect(localDateTimeToInstant('not a time', KL)).toBeNull();
  });
});
