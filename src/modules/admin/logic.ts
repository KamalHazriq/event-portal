/**
 * Module 6 logic: the surprise countdown, and what the live control page
 * needs to show while a session is running.
 *
 * Pure functions only. See logic.test.ts.
 */
import type { EventConfig } from '@/lib/event-schema';
import { localDateTimeToInstant, type EventNow } from '@/lib/time';

/**
 * The countdown is set in config/event.json, but an admin moves it during the
 * event, so the stored settings win. Config is the starting position, not the
 * final word.
 */
export const SURPRISE_KEYS = {
  enabled: 'surprise.enabled',
  targetAt: 'surprise.targetAt',
  label: 'surprise.label',
} as const;

export const MAX_SURPRISE_LABEL = 80;

const LOCAL_DATE_TIME = /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/;

export type Surprise = {
  enabled: boolean;
  label: string;
  /** Local time in the event time zone, "2026-12-15T20:30". */
  targetAt: string | null;
  /** True when an admin has overridden what the config file says. */
  overridden: boolean;
};

export function isLocalDateTime(value: unknown): value is string {
  return typeof value === 'string' && LOCAL_DATE_TIME.test(value.trim());
}

/** Settings first, then the config file, then off. */
export function resolveSurprise(
  config: EventConfig,
  settings: { enabled: string | null; targetAt: string | null; label: string | null },
): Surprise {
  const fromConfig = config.surprise;

  const overridden =
    settings.enabled !== null || settings.targetAt !== null || settings.label !== null;

  const enabled =
    settings.enabled !== null ? settings.enabled === 'true' : (fromConfig?.enabled ?? false);

  const targetAt = isLocalDateTime(settings.targetAt)
    ? settings.targetAt.trim()
    : (fromConfig?.targetAt ?? null);

  const label =
    settings.label && settings.label.length > 0
      ? settings.label
      : (fromConfig?.label ?? 'Starting soon');

  return { enabled, label, targetAt, overridden };
}

/** When the countdown runs out, as a real instant. Null if it is not set. */
export function surpriseInstant(surprise: Surprise, timezone: string): Date | null {
  if (!surprise.targetAt) return null;
  return localDateTimeToInstant(surprise.targetAt, timezone);
}

/**
 * "2 hours 15 minutes", "45 seconds", "now".
 *
 * Seconds only appear under two minutes, because a number ticking every
 * second on a projector pulls the room's eyes away from whoever is speaking.
 */
export function formatCountdown(millisecondsLeft: number): string {
  if (millisecondsLeft <= 0) return 'now';

  const totalSeconds = Math.floor(millisecondsLeft / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const part = (value: number, word: string) => `${value} ${word}${value === 1 ? '' : 's'}`;

  if (hours > 0) {
    return minutes > 0 ? `${part(hours, 'hour')} ${part(minutes, 'minute')}` : part(hours, 'hour');
  }
  if (totalSeconds >= 120) return part(minutes, 'minute');
  if (minutes > 0) return `${part(minutes, 'minute')} ${part(seconds, 'second')}`;
  return part(seconds, 'second');
}

/** Minutes left in a session that is running, for the "wrap up" nudge. */
export function minutesLeftInSession(
  session: { date: string; endMinutes: number },
  now: EventNow,
): number | null {
  if (session.date !== now.date) return null;
  const left = session.endMinutes - now.minutes;
  return left >= 0 ? left : null;
}

/**
 * How a running session is going against the clock, so the MC can see at a
 * glance whether to move things along.
 */
export type RunningState = 'early' | 'on-time' | 'wrapping-up' | 'over';

export function runningState(minutesLeft: number | null, lengthMinutes: number): RunningState {
  if (minutesLeft === null) return 'over';
  if (minutesLeft <= 0) return 'over';
  if (minutesLeft <= 5) return 'wrapping-up';
  if (minutesLeft > lengthMinutes * 0.75) return 'early';
  return 'on-time';
}

export function runningStateLabel(state: RunningState): string {
  switch (state) {
    case 'early':
      return 'Just started';
    case 'on-time':
      return 'Running';
    case 'wrapping-up':
      return 'Wrapping up';
    case 'over':
      return 'Should have ended';
    default: {
      const unreachable: never = state;
      return String(unreachable);
    }
  }
}

/** Offers for the "start the countdown" buttons, in minutes from now. */
export const QUICK_COUNTDOWNS = [5, 10, 15, 30, 60] as const;

/**
 * Turns "in 15 minutes" into the local date and time the setting stores.
 * Seconds are dropped, so the countdown lands on a whole minute.
 */
export function countdownTargetFromNow(now: EventNow, minutesFromNow: number): string {
  const total = now.minutes + minutesFromNow;
  const dayOffset = Math.floor(total / (24 * 60));
  const minuteOfDay = ((total % (24 * 60)) + 24 * 60) % (24 * 60);

  const date = new Date(`${now.date}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + dayOffset);
  const shifted = date.toISOString().slice(0, 10);

  const hh = String(Math.floor(minuteOfDay / 60)).padStart(2, '0');
  const mm = String(minuteOfDay % 60).padStart(2, '0');
  return `${shifted}T${hh}:${mm}`;
}
