/**
 * Module 8 logic: which view the projector shows, and the small amount of
 * shaping each view needs.
 *
 * Pure functions only. See logic.test.ts.
 *
 * How it works in the room: the projector laptop opens /screen once and
 * leaves it open. The MC picks a view on /admin/big-screen from a phone. The
 * choice is a setting, and /screen re-reads it every few seconds (short
 * polling, brief hard rule 7), so the projector follows within seconds.
 */

export const SCREEN_VIEWS = ['welcome', 'now-next', 'arrivals', 'countdown'] as const;
export type ScreenView = (typeof SCREEN_VIEWS)[number];

export const SCREEN_KEYS = {
  view: 'bigscreen.view',
  hideNames: 'bigscreen.hideNames',
} as const;

export const DEFAULT_SCREEN_VIEW: ScreenView = 'welcome';

export function isScreenView(value: unknown): value is ScreenView {
  return typeof value === 'string' && (SCREEN_VIEWS as readonly string[]).includes(value);
}

export type ScreenSettings = { view: ScreenView; hideNames: boolean };

/** Stored settings, with anything missing or unrecognised falling back. */
export function resolveScreenSettings(stored: {
  view: string | null;
  hideNames: string | null;
}): ScreenSettings {
  return {
    view: isScreenView(stored.view) ? stored.view : DEFAULT_SCREEN_VIEW,
    hideNames: stored.hideNames === 'true',
  };
}

export const SCREEN_VIEW_INFO: Record<
  ScreenView,
  { title: string; description: string; whenToUse: string }
> = {
  welcome: {
    title: 'Welcome',
    description: 'Event name, dates and the portal QR, large enough to scan from a table.',
    whenToUse: 'Doors open and between sessions',
  },
  'now-next': {
    title: 'Now and next',
    description: 'What is running with the time it ends, and what comes after it.',
    whenToUse: 'Breaks, so people know when to come back',
  },
  arrivals: {
    title: 'Arrivals',
    description: 'A live "42 / 78 arrived" counter, with a welcome card for each check in.',
    whenToUse: 'Registration each morning',
  },
  countdown: {
    title: 'Countdown',
    description: 'Big numbers counting down to the surprise. Set it on the live control page.',
    whenToUse: 'The build up to the surprise',
  },
};

/**
 * How often /screen re-reads the server. Four seconds is inside the three to
 * five the brief asks for, and fast enough that a view switch feels instant.
 */
export const SCREEN_POLL_MS = 4_000;

/**
 * "14:59", "1:04:59", "2 days 3:04:59", "0:00". Digits, not words, for a
 * projector. Days only appear when the target is a day or more away, which
 * should only happen while someone is testing it.
 */
export function formatCountdownDigits(millisecondsLeft: number): string {
  // Round up, so the screen shows 0:01 for the final second rather than 0:00.
  const total = Math.max(0, Math.ceil(millisecondsLeft / 1000));
  const days = Math.floor(total / 86_400);
  const hours = Math.floor((total % 86_400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const ss = String(seconds).padStart(2, '0');
  const mm = String(minutes).padStart(2, '0');
  if (days > 0) return `${days} ${days === 1 ? 'day' : 'days'} ${hours}:${mm}:${ss}`;
  if (hours > 0) return `${hours}:${mm}:${ss}`;
  return `${minutes}:${ss}`;
}

/**
 * The room count on the big screen: guests only. The desk headcount counts
 * the secretariat too, because everyone with a tag is expected at the desk,
 * but "42 / 78 arrived" on the projector is about the guests in the room.
 */
export function guestCount(
  attendees: { id: string; isSecretariat: boolean }[],
  checkedInIds: Iterable<string>,
): { arrived: number; expected: number } {
  const guests = new Set(attendees.filter((a) => !a.isSecretariat).map((a) => a.id));
  let arrived = 0;
  for (const id of new Set(checkedInIds)) if (guests.has(id)) arrived += 1;
  return { arrived, expected: guests.size };
}

export type ArrivalCard = { key: string; name: string; department: string };

/**
 * The welcome cards on the arrivals view, newest first. With names hidden it
 * returns nothing at all, so a name can never reach the screen by accident.
 */
export function arrivalCards(
  recent: { id: string; attendee: { name: string; department: string; isSecretariat: boolean } }[],
  hideNames: boolean,
  limit = 6,
): ArrivalCard[] {
  if (hideNames) return [];
  return recent
    .filter((row) => !row.attendee.isSecretariat)
    .slice(0, Math.max(0, limit))
    .map((row) => ({ key: row.id, name: row.attendee.name, department: row.attendee.department }));
}

/** "14:05" from minutes after midnight, for the corner clock. */
export function clockFromMinutes(minutes: number): string {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}
