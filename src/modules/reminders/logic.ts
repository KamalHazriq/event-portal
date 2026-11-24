/**
 * Scheduled reminders: a message with a date and time, sent as a
 * notification to the team (or everyone) when the time comes. Pure
 * functions; the sending is in dispatch.ts. See logic.test.ts.
 */
export const REMINDERS_KEY = 'team.reminders';
export const REMINDERS_PING_KEY = 'team.reminders.lastRun';

/** A reminder this much late (the scheduler was down) is marked missed, not sent. */
export const LATE_GRACE_MS = 3 * 60 * 60 * 1000;
export const MAX_REMINDERS = 100;
export const MAX_REMINDER_CHARS = 200;

export type Reminder = {
  id: string;
  /** Local date and time in the event's time zone, like 2026-12-14T07:00. */
  at: string;
  text: string;
  audience: 'team' | 'everyone';
  /** Where tapping it goes, like /agenda. Empty for the home page. */
  href?: string;
  /** For everyone: send a notification as well as the banner. Defaults to yes. */
  push?: boolean;
  /** How long its banner stays up, in minutes (0: until taken down). */
  minutes?: number;
  /** When it was sent, as an ISO instant. */
  sentAt?: string;
};

export type ReminderStatus = 'sent' | 'pending' | 'missed';

const LOCAL = /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/;

export function isLocalDateTime(value: string): boolean {
  return LOCAL.test(value);
}

function isReminder(value: unknown): value is Reminder {
  const r = value as Reminder;
  return (
    !!r &&
    typeof r.id === 'string' &&
    typeof r.text === 'string' &&
    typeof r.at === 'string' &&
    LOCAL.test(r.at) &&
    (r.audience === 'team' || r.audience === 'everyone') &&
    (r.sentAt === undefined || typeof r.sentAt === 'string')
  );
}

export function parseReminders(raw: string | null): Reminder[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value.filter(isReminder).slice(0, MAX_REMINDERS) : [];
  } catch {
    return [];
  }
}

/** Turns a local date and time in the event's zone into an instant, or null. */
export type ToInstant = (local: string) => Date | null;

export function reminderStatus(r: Reminder, now: Date, toInstant: ToInstant): ReminderStatus {
  if (r.sentAt) return 'sent';
  const due = toInstant(r.at);
  if (!due) return 'missed';
  if (due.getTime() > now.getTime()) return 'pending';
  return now.getTime() - due.getTime() > LATE_GRACE_MS ? 'missed' : 'pending';
}

/** Reminders whose time has come, not yet sent, and not too late to be useful. */
export function dueReminders(list: Reminder[], now: Date, toInstant: ToInstant): Reminder[] {
  return list.filter((r) => {
    if (r.sentAt) return false;
    const due = toInstant(r.at);
    if (!due) return false;
    const late = now.getTime() - due.getTime();
    return late >= 0 && late <= LATE_GRACE_MS;
  });
}

/** Oldest first, so the list reads in the order things happen. */
export function sortReminders(list: Reminder[]): Reminder[] {
  return [...list].sort((a, b) => a.at.localeCompare(b.at));
}

/** Whether a request's secret matches. Null or empty configured secret means disabled. */
export function secretMatches(
  configured: string | undefined,
  offered: string | null,
  equal: (a: string, b: string) => boolean,
): boolean {
  if (!configured || !offered) return false;
  return equal(configured, offered);
}
