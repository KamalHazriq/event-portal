/**
 * Announcements: one short message from the secretariat, shown at the top of
 * every attendee page (and, if chosen, sent to phones that turned on alerts).
 * Kept in the settings table: the current one and the last few sent.
 */
export const ANNOUNCE_KEYS = { current: 'announce.current', history: 'announce.history' } as const;

export const ANNOUNCE_MAX_CHARS = 200;
/** An announcement nobody removed disappears by itself after this long. */
export const ANNOUNCE_HOURS = 12;
export const HISTORY_SIZE = 10;

export type Announcement = {
  id: string;
  text: string;
  /** A page in the portal to open, such as "/agenda". Empty for none. */
  href: string;
  at: string;
  /** How many phones it was sent to as a notification, or null if not sent. */
  pushed: number | null;
};

/** Only paths inside the portal, never another site. */
export function safeHref(value: string): string {
  const v = value.trim();
  return /^\/[a-z0-9/_-]*$/i.test(v) && !v.startsWith('//') ? v : '';
}

function isAnnouncement(value: unknown): value is Announcement {
  const a = value as Announcement;
  return (
    !!a &&
    typeof a.id === 'string' &&
    typeof a.text === 'string' &&
    typeof a.href === 'string' &&
    typeof a.at === 'string'
  );
}

export function parseAnnouncement(raw: string | null): Announcement | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    return isAnnouncement(value) ? { ...value, href: safeHref(value.href) } : null;
  } catch {
    return null;
  }
}

export function parseHistory(raw: string | null): Announcement[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value.filter(isAnnouncement).slice(0, HISTORY_SIZE) : [];
  } catch {
    return [];
  }
}

/** Still showing: posted less than ANNOUNCE_HOURS ago. */
export function isLive(a: Announcement | null, now: Date): a is Announcement {
  if (!a) return false;
  const at = Date.parse(a.at);
  return Number.isFinite(at) && now.getTime() - at < ANNOUNCE_HOURS * 60 * 60 * 1000;
}

/** Tidies what was typed: one line of plain text, cut to the limit. */
export function cleanAnnouncementText(value: string): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, ANNOUNCE_MAX_CHARS);
}

/* --------------------------------------------------------- phone alerts */

export type AlertSupport = 'unknown' | 'unsupported' | 'install-first' | 'blocked' | 'ready';

/**
 * Whether this phone can turn on alerts. iPhones and iPads only allow it
 * from the home screen (Share, Add to Home Screen), so they are told that
 * first rather than shown a button that does nothing.
 */
export function alertSupport(env: {
  serviceWorker: boolean;
  pushManager: boolean;
  notification: boolean;
  ios: boolean;
  standalone: boolean;
  permission: 'default' | 'granted' | 'denied' | null;
}): AlertSupport {
  if (env.ios && !env.standalone) return 'install-first';
  if (!env.serviceWorker || !env.pushManager || !env.notification) return 'unsupported';
  if (env.permission === 'denied') return 'blocked';
  return 'ready';
}

/* ------------------------------------------------- feedback reminders */

export const NUDGE_KEYS = {
  enabled: 'announce.feedbackNudges',
  sentFor: (sessionId: string) => `announce.nudged.${sessionId}`,
} as const;

/** How long after a talk ends the reminder can still go out. */
export const NUDGE_WINDOW_MINUTES = 15;

/**
 * Talks whose feedback reminder is due now: feedback on, ended within the
 * last NUDGE_WINDOW_MINUTES today, and not reminded yet. A projector or
 * admin page that was closed for a while does not send old reminders.
 */
export function dueFeedbackNudges<
  S extends { id: string; feedbackEnabled: boolean; hidden?: boolean; end: string },
>(
  days: { date: string; sessions: S[] }[],
  now: { date: string; minutes: number },
  alreadySent: (sessionId: string) => boolean,
  toMinutes: (clock: string) => number,
): S[] {
  const today = days.find((d) => d.date === now.date);
  if (!today) return [];
  return today.sessions.filter((s) => {
    if (!s.feedbackEnabled || s.hidden) return false;
    const end = toMinutes(s.end);
    return now.minutes >= end && now.minutes < end + NUDGE_WINDOW_MINUTES && !alreadySent(s.id);
  });
}

/**
 * Push addresses come from the phone's browser, so the server only sends to
 * the browser makers' push services, never to an address someone typed in.
 * Hosts ending in ".invalid" can never resolve, so tests may use them.
 */
const PUSH_HOSTS = [
  /^fcm\.googleapis\.com$/,
  /^android\.googleapis\.com$/,
  /(^|\.)push\.services\.mozilla\.com$/,
  /(^|\.)notify\.windows\.com$/,
  /(^|\.)push\.apple\.com$/,
  /\.invalid$/,
];

export function isPushServiceUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && PUSH_HOSTS.some((re) => re.test(url.hostname));
  } catch {
    return false;
  }
}
