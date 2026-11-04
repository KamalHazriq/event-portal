/**
 * Event time.
 *
 * The portal always thinks in the event's own time zone (Asia/Kuala_Lumpur),
 * not the server's. A laptop in another region, or a host running on UTC,
 * must still show the right "now" and "next".
 *
 * There are no date libraries here on purpose (brief hard rule 6: keep the
 * bundle small). Intl, which is built into Node and every browser, is enough.
 */

/** A moment, expressed the way the agenda is written. */
export type EventNow = {
  /** Calendar date in the event time zone, as YYYY-MM-DD. */
  date: string;
  /** Minutes since midnight in the event time zone, so 14:30 is 870. */
  minutes: number;
  /** True when a dev override is in force, so the UI can say so. */
  isOverride: boolean;
};

const DATE_TIME_PATTERN = /^(\d{4}-\d{2}-\d{2})T([01]\d|2[0-3]):([0-5]\d)/;

/** "14:30" to 870. Returns NaN for anything that is not a 24-hour time. */
export function toMinutes(clockTime: string): number {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(clockTime);
  if (!match) return Number.NaN;
  return Number(match[1]) * 60 + Number(match[2]);
}

/** 870 to "14:30". */
export function fromMinutes(minutes: number): string {
  const clamped = Math.max(0, Math.min(24 * 60 - 1, Math.round(minutes)));
  const hours = Math.floor(clamped / 60);
  const mins = clamped % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

/**
 * "14:30" to "2:30 pm". Lower case am/pm, a space before it, no em dashes.
 */
export function formatClock(clockTime: string): string {
  const minutes = toMinutes(clockTime);
  if (Number.isNaN(minutes)) return clockTime;
  const hours24 = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const suffix = hours24 < 12 ? 'am' : 'pm';
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${String(mins).padStart(2, '0')} ${suffix}`;
}

/** "09:00" and "10:30" to "9:00 am to 10:30 am". */
export function formatTimeRange(start: string, end: string): string {
  return `${formatClock(start)} to ${formatClock(end)}`;
}

/**
 * Where the wall clock is right now, in the given time zone.
 * Throws if the time zone name is not one Node knows.
 */
export function wallClockInZone(timezone: string, at: Date = new Date()): EventNow {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(at);

  const get = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? '';

  const date = `${get('year')}-${get('month')}-${get('day')}`;
  const minutes = Number(get('hour')) * 60 + Number(get('minute'));
  return { date, minutes, isOverride: false };
}

/**
 * Reads a dev override like "2026-12-14T14:30".
 * Returns null when the value is missing or not in that shape.
 */
export function parseTimeOverride(value: string | null | undefined): EventNow | null {
  if (!value) return null;
  const match = DATE_TIME_PATTERN.exec(value.trim());
  if (!match) return null;
  return {
    date: match[1] as string,
    minutes: Number(match[2]) * 60 + Number(match[3]),
    isOverride: true,
  };
}

/**
 * Whether a ?now= parameter is allowed to change what the portal shows.
 *
 * Always allowed while developing. On a deployed build it needs
 * ALLOW_TIME_OVERRIDE=true, which is useful for a rehearsal and should be
 * turned off again before the event.
 */
export function timeOverrideAllowed(): boolean {
  if (process.env.NODE_ENV !== 'production') return true;
  return process.env.ALLOW_TIME_OVERRIDE === 'true';
}

/**
 * The one function pages use to ask what time it is.
 *
 * Order of preference: the ?now= URL parameter, then DEV_FAKE_NOW from
 * .env.local, then the real clock. The first two only count when
 * timeOverrideAllowed() says so.
 */
export function resolveEventNow(options: {
  timezone: string;
  /** The raw ?now= value from the URL, if any. */
  overrideParam?: string | null;
  /** Injectable for tests. */
  at?: Date;
}): EventNow {
  if (timeOverrideAllowed()) {
    const fromUrl = parseTimeOverride(options.overrideParam);
    if (fromUrl) return fromUrl;
    const fromEnv = parseTimeOverride(process.env.DEV_FAKE_NOW);
    if (fromEnv) return fromEnv;
  }
  return wallClockInZone(options.timezone, options.at ?? new Date());
}

/**
 * Compares two moments on the agenda. Negative when a is earlier.
 */
export function compareMoments(
  a: { date: string; minutes: number },
  b: { date: string; minutes: number },
): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  return a.minutes - b.minutes;
}

/**
 * Formats a date and drops the comma Intl puts after the weekday, so the UI
 * reads "Monday 14 December 2026" rather than "Monday, 14 December 2026".
 */
function formatDateParts(
  isoDate: string,
  timezone: string,
  options: Intl.DateTimeFormatOptions,
): string {
  // Midday avoids any chance of the date shifting when the zone is applied.
  const parsed = new Date(`${isoDate}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return isoDate;

  return new Intl.DateTimeFormat('en-GB', { timeZone: timezone, ...options })
    .formatToParts(parsed)
    .map((part) => (part.type === 'literal' ? part.value.replace(/,/g, '') : part.value))
    .join('')
    .trim();
}

/** "2026-12-14" to "Monday 14 December 2026". */
export function formatLongDate(isoDate: string, timezone: string): string {
  return formatDateParts(isoDate, timezone, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** "2026-12-14" to "Mon 14 Dec". Used where space is tight. */
export function formatShortDate(isoDate: string, timezone: string): string {
  return formatDateParts(isoDate, timezone, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

/**
 * Turns a local event date and time into a real instant.
 *
 * Needed by the countdown: "9 pm in Kuala Lumpur" has to become a UTC
 * timestamp the browser can count down to. Works by guessing UTC, measuring
 * how far off the zone is at that moment, and correcting once. One pass is
 * enough for every zone with a whole or half hour offset.
 */
export function localDateTimeToInstant(localDateTime: string, timezone: string): Date | null {
  const match = DATE_TIME_PATTERN.exec(localDateTime.trim());
  if (!match) return null;

  const guess = new Date(`${localDateTime}:00Z`);
  if (Number.isNaN(guess.getTime())) return null;

  const seen = wallClockInZone(timezone, guess);
  const wanted = { date: match[1] as string, minutes: Number(match[2]) * 60 + Number(match[3]) };

  const dayDelta =
    (Date.parse(`${seen.date}T00:00:00Z`) - Date.parse(`${wanted.date}T00:00:00Z`)) / 60_000;
  const driftMinutes = dayDelta + (seen.minutes - wanted.minutes);

  return new Date(guess.getTime() - driftMinutes * 60_000);
}
