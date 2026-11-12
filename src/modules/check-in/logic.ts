/**
 * Module 4 logic: working out which day someone is checking in for, and
 * making sense of whatever the scanner hands us.
 *
 * Pure functions only, so the fiddly parts can be tested without a camera,
 * a database or a browser. See logic.test.ts.
 */
import type { Day, EventConfig } from '@/lib/event-schema';
import type { EventNow } from '@/lib/time';

/** Characters a check in token can contain. Matches base64url. */
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;

/** The path a personal QR code points at. Kept short so the QR stays small. */
export const CHECK_IN_PATH = '/c';

/**
 * What a name tag QR contains.
 *
 * A full URL rather than a bare token, so a phone's own camera app can open
 * it too. Our scanner understands both.
 */
export function buildCheckInUrl(portalUrl: string, token: string): string {
  const base = portalUrl.replace(/\/+$/, '');
  return `${base}${CHECK_IN_PATH}/${token}`;
}

/**
 * Pulls a check in token out of whatever was scanned or typed.
 *
 * Handles our own URL, a bare token, and the trailing newline a hardware
 * barcode scanner sends when it acts as a keyboard. Returns null for anything
 * it does not recognise, so a stray QR code on someone's lanyard is ignored
 * rather than being treated as a token.
 */
export function parseScanPayload(raw: string): string | null {
  const text = raw.trim().replace(/[\r\n]+$/, '');
  if (text.length === 0) return null;

  if (/^https?:\/\//i.test(text)) {
    let path: string;
    try {
      path = new URL(text).pathname;
    } catch {
      return null;
    }
    const match = new RegExp(`${CHECK_IN_PATH}/([A-Za-z0-9_-]+)/?$`).exec(path);
    const token = match?.[1];
    return token && TOKEN_PATTERN.test(token) ? token : null;
  }

  return TOKEN_PATTERN.test(text) ? text : null;
}

/**
 * Which day the desk is checking people in for.
 *
 * Today during the event. Before it starts, Day 1, so a rehearsal works.
 * After it ends, the last day, so late admin still lands somewhere sensible.
 */
export function resolveCheckInDay(
  days: Day[],
  now: EventNow,
  requestedDayId?: string | null,
): Day | null {
  if (days.length === 0) return null;

  if (requestedDayId) {
    const requested = days.find((day) => day.id === requestedDayId);
    if (requested) return requested;
  }

  const today = days.find((day) => day.date === now.date);
  if (today) return today;

  const sorted = [...days].sort((a, b) => (a.date < b.date ? -1 : 1));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (!first || !last) return null;

  return now.date < first.date ? first : last;
}

/** The days a desk can pick between, oldest first. */
export function checkInDays(config: EventConfig): Day[] {
  return [...config.days].sort((a, b) => (a.date < b.date ? -1 : 1));
}

export type ArrivalRate = {
  arrived: number;
  expected: number;
  /** 0 to 100, rounded, for the progress bar and the big screen. */
  percent: number;
  remaining: number;
};

export function arrivalRate(arrived: number, expected: number): ArrivalRate {
  const safeExpected = Math.max(0, expected);
  const safeArrived = Math.min(Math.max(0, arrived), safeExpected || arrived);
  return {
    arrived: safeArrived,
    expected: safeExpected,
    percent: safeExpected === 0 ? 0 : Math.round((safeArrived / safeExpected) * 100),
    remaining: Math.max(0, safeExpected - safeArrived),
  };
}

/**
 * What the desk sees after a scan. Kept as a small set of named outcomes so
 * the screen can be loud and unambiguous at a busy desk.
 */
export type ScanOutcome =
  | 'checked-in'
  | 'already-checked-in'
  | 'choose'
  | 'not-found'
  | 'card-not-found'
  | 'unreadable'
  | 'rate-limited'
  | 'error';

export function scanOutcomeMessage(outcome: ScanOutcome): string {
  switch (outcome) {
    case 'checked-in':
      return 'Checked in';
    case 'already-checked-in':
      return 'Already checked in';
    case 'choose':
      return 'Which person is this?';
    case 'not-found':
      return 'Tag not recognised';
    case 'card-not-found':
      return 'Business card not on the list';
    case 'unreadable':
      return 'Could not read that code';
    case 'rate-limited':
      return 'Too many scans, wait a moment';
    case 'error':
      return 'Something went wrong, try again';
    default: {
      const unreachable: never = outcome;
      return String(unreachable);
    }
  }
}

/** Sorts departments by who is furthest behind, for the desk to chase. */
export function sortByOutstanding<T extends { expected: number; arrived: number }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const left = a.expected - a.arrived;
    const right = b.expected - b.arrived;
    if (left !== right) return right - left;
    return b.expected - a.expected;
  });
}
