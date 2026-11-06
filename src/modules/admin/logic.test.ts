import { describe, expect, it } from 'vitest';

import { getEventConfig } from '@/lib/config';
import type { EventNow } from '@/lib/time';

import {
  countdownTargetFromNow,
  formatCountdown,
  isLocalDateTime,
  minutesLeftInSession,
  resolveSurprise,
  runningState,
  runningStateLabel,
  surpriseInstant,
} from './logic';

const at = (date: string, clock: string): EventNow => {
  const [h, m] = clock.split(':').map(Number);
  return { date, minutes: (h ?? 0) * 60 + (m ?? 0), isOverride: false };
};

const noSettings = { enabled: null, targetAt: null, label: null };

describe('resolveSurprise', () => {
  const config = getEventConfig();

  it('uses the config file when an admin has changed nothing', () => {
    const surprise = resolveSurprise(config, noSettings);

    expect(surprise.enabled).toBe(true);
    expect(surprise.targetAt).toBe('2026-12-15T20:30');
    expect(surprise.label).toBe('Something special starts in');
    expect(surprise.overridden).toBe(false);
  });

  it('lets an admin move the time during the event', () => {
    const surprise = resolveSurprise(config, { ...noSettings, targetAt: '2026-12-15T21:15' });

    expect(surprise.targetAt).toBe('2026-12-15T21:15');
    expect(surprise.overridden).toBe(true);
  });

  it('lets an admin switch it off without touching the config file', () => {
    const surprise = resolveSurprise(config, { ...noSettings, enabled: 'false' });

    expect(surprise.enabled).toBe(false);
    expect(surprise.overridden).toBe(true);
  });

  it('lets an admin switch it on when the config file has it off', () => {
    const off = { ...config, surprise: { ...config.surprise!, enabled: false } };
    expect(resolveSurprise(off, { ...noSettings, enabled: 'true' }).enabled).toBe(true);
  });

  it('ignores a stored time that is not a time', () => {
    const surprise = resolveSurprise(config, { ...noSettings, targetAt: 'tomorrow night' });
    expect(surprise.targetAt).toBe('2026-12-15T20:30');
  });

  it('copes with an event that has no surprise at all', () => {
    const bare = { ...config, surprise: undefined };
    const surprise = resolveSurprise(bare, noSettings);

    expect(surprise.enabled).toBe(false);
    expect(surprise.targetAt).toBeNull();
    expect(surprise.label).toBe('Starting soon');
  });
});

describe('surpriseInstant', () => {
  it('turns the event local time into a real moment', () => {
    const instant = surpriseInstant(
      { enabled: true, label: 'x', targetAt: '2026-12-15T20:30', overridden: false },
      'Asia/Kuala_Lumpur',
    );
    // 20:30 in Kuala Lumpur is 12:30 UTC.
    expect(instant?.toISOString()).toBe('2026-12-15T12:30:00.000Z');
  });

  it('is null when no time is set', () => {
    expect(
      surpriseInstant(
        { enabled: true, label: 'x', targetAt: null, overridden: false },
        'Asia/Kuala_Lumpur',
      ),
    ).toBeNull();
  });
});

describe('formatCountdown', () => {
  it('counts down in hours and minutes when there is a while to go', () => {
    expect(formatCountdown(2 * 3600_000 + 15 * 60_000)).toBe('2 hours 15 minutes');
    expect(formatCountdown(1 * 3600_000)).toBe('1 hour');
  });

  it('drops to minutes only under an hour', () => {
    expect(formatCountdown(25 * 60_000)).toBe('25 minutes');
    expect(formatCountdown(2 * 60_000)).toBe('2 minutes');
  });

  it('shows seconds only in the last two minutes', () => {
    expect(formatCountdown(90_000)).toBe('1 minute 30 seconds');
    expect(formatCountdown(45_000)).toBe('45 seconds');
    expect(formatCountdown(1_000)).toBe('1 second');
  });

  it('says now once it has run out', () => {
    expect(formatCountdown(0)).toBe('now');
    expect(formatCountdown(-5_000)).toBe('now');
  });

  it('uses no em dashes, per the brief', () => {
    const samples = [formatCountdown(7_200_000), formatCountdown(45_000)].join(' ');
    expect(samples).not.toMatch(/[—–]/);
  });
});

describe('how a running session is going', () => {
  const session = { date: '2026-12-14', endMinutes: 900 }; // ends 15:00

  it('counts the minutes left', () => {
    expect(minutesLeftInSession(session, at('2026-12-14', '14:30'))).toBe(30);
    expect(minutesLeftInSession(session, at('2026-12-14', '15:00'))).toBe(0);
  });

  it('is null once the day has moved on', () => {
    expect(minutesLeftInSession(session, at('2026-12-15', '09:00'))).toBeNull();
  });

  it('is null after the end, rather than going negative', () => {
    expect(minutesLeftInSession(session, at('2026-12-14', '15:30'))).toBeNull();
  });

  it('names the state the MC cares about', () => {
    expect(runningState(50, 60)).toBe('early');
    expect(runningState(30, 60)).toBe('on-time');
    expect(runningState(4, 60)).toBe('wrapping-up');
    expect(runningState(0, 60)).toBe('over');
    expect(runningState(null, 60)).toBe('over');
  });

  it('describes each state in plain English', () => {
    expect(runningStateLabel('wrapping-up')).toBe('Wrapping up');
    expect(runningStateLabel('over')).toBe('Should have ended');
  });
});

describe('countdownTargetFromNow', () => {
  it('adds minutes to the clock', () => {
    expect(countdownTargetFromNow(at('2026-12-15', '20:00'), 30)).toBe('2026-12-15T20:30');
    expect(countdownTargetFromNow(at('2026-12-15', '20:00'), 5)).toBe('2026-12-15T20:05');
  });

  it('rolls over into the next day', () => {
    expect(countdownTargetFromNow(at('2026-12-15', '23:45'), 30)).toBe('2026-12-16T00:15');
  });

  it('produces a value the setting accepts', () => {
    expect(isLocalDateTime(countdownTargetFromNow(at('2026-12-15', '09:07'), 60))).toBe(true);
  });
});

describe('isLocalDateTime', () => {
  it('accepts the shape the settings store', () => {
    expect(isLocalDateTime('2026-12-15T20:30')).toBe(true);
  });

  it('refuses anything else', () => {
    expect(isLocalDateTime('2026-12-15')).toBe(false);
    expect(isLocalDateTime('2026-12-15T25:00')).toBe(false);
    expect(isLocalDateTime('')).toBe(false);
    expect(isLocalDateTime(null)).toBe(false);
    expect(isLocalDateTime(42)).toBe(false);
  });
});
