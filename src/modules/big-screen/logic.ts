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

export const SCREEN_VIEWS = [
  'welcome',
  'now-next',
  'arrivals',
  'countdown',
  'lucky-draw',
  'name-picker',
  'photos',
  'qa',
  'poll',
  'leaderboard',
  'comments',
  'podium',
  'feedback',
  'loop',
  'slides',
] as const;
export type ScreenView = (typeof SCREEN_VIEWS)[number];

export const SCREEN_KEYS = {
  view: 'bigscreen.view',
  hideNames: 'bigscreen.hideNames',
  /** Calm mode: no moving background and no hexagon wipe, for a weak projector laptop. */
  calm: 'bigscreen.calm',
  /** The podium: how many places (3, 5 or 10) and how many the MC has revealed so far. */
  podiumSize: 'bigscreen.podium.size',
  podiumStep: 'bigscreen.podium.step',
  /** What the feedback QR is for: "auto" (the session now or just finished), "event", or a session id. */
  feedbackTarget: 'bigscreen.feedback.target',
} as const;

export const DEFAULT_SCREEN_VIEW: ScreenView = 'welcome';

export function isScreenView(value: unknown): value is ScreenView {
  return typeof value === 'string' && (SCREEN_VIEWS as readonly string[]).includes(value);
}

export type ScreenSettings = { view: ScreenView; hideNames: boolean; calm: boolean };

/** Stored settings, with anything missing or unrecognised falling back. */
export function resolveScreenSettings(stored: {
  view: string | null;
  hideNames: string | null;
  calm?: string | null;
}): ScreenSettings {
  return {
    view: isScreenView(stored.view) ? stored.view : DEFAULT_SCREEN_VIEW,
    hideNames: stored.hideNames === 'true',
    calm: stored.calm === 'true',
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
    description:
      'A live "42 / 78" guest counter, the newest arrival in a spotlight, and a rolling list of who came in.',
    whenToUse: 'Registration each morning',
  },
  countdown: {
    title: 'Countdown',
    description: 'Big numbers counting down to the surprise. Set it on the live control page.',
    whenToUse: 'The build up to the surprise',
  },
  photos: {
    title: 'Photo wall',
    description:
      'Approved photos as a slideshow, grid or mosaic (choose on the Photos page). New ones pop up large.',
    whenToUse: 'Breaks and dinner',
  },
  qa: {
    title: 'Top questions',
    description: 'The most voted approved questions for a session. Backup Q&A only.',
    whenToUse: 'Question time, if Slido is down',
  },
  poll: {
    title: 'Poll',
    description: 'The open poll with a QR to answer it, then the results once revealed.',
    whenToUse: 'Polls, if Slido is down',
  },
  comments: {
    title: 'Comments',
    description: 'The most liked approved comments on a talk, with a QR to add one.',
    whenToUse: 'After a talk, or while people are reacting',
  },
  loop: {
    title: 'Screensaver',
    description:
      'Riddles that reveal their answer, "Do you know?" facts and new leads and heads, one card at a time. Edit them on the Screensaver page.',
    whenToUse: 'Breaks, lunch and any quiet time',
  },
  slides: {
    title: 'Hand over to slides',
    description:
      'A plain black screen, so the projector laptop can switch to PowerPoint (Alt+Tab) and show the deck without the portal behind it.',
    whenToUse: 'When a speaker or the MC shows their own slides',
  },
  feedback: {
    title: 'Feedback QR',
    description:
      'A big QR code that opens the feedback form for the session on now (or the one that just finished), or for the whole summit.',
    whenToUse: 'The end of a session, and at the closing',
  },
  podium: {
    title: 'Podium reveal',
    description:
      'The top 3, 5 or 10, revealed one place at a time from the bottom up, with confetti. The MC taps the Reveal button, which names the place coming up.',
    whenToUse: 'The closing, when the winners are announced',
  },
  leaderboard: {
    title: 'Leaderboard',
    description: 'The top eight people and the department ranking, with a QR to join.',
    whenToUse: 'Breaks, and before the closing',
  },
  'name-picker': {
    title: 'Name picker',
    description:
      'Spins names and stops on the people picked to speak. Pick on the name picker page.',
    whenToUse: 'Sharing rounds and Q&A, to choose who talks',
  },
  'lucky-draw': {
    title: 'Lucky draw',
    description: 'Spins through the names and stops on the winners. Draw on the lucky draw page.',
    whenToUse: 'Dinner and the closing',
  },
};

/** Views that belong to a module the config can switch off. */
export function availableScreenViews(features: {
  luckyDraw: boolean;
  photoWall: boolean;
  qa: boolean;
  polls: boolean;
  leaderboard?: boolean;
  comments?: boolean;
  feedback?: boolean;
}): ScreenView[] {
  return SCREEN_VIEWS.filter(
    (view) =>
      (view !== 'lucky-draw' || features.luckyDraw) &&
      (view !== 'photos' || features.photoWall) &&
      (view !== 'qa' || features.qa) &&
      (view !== 'poll' || features.polls) &&
      (view !== 'leaderboard' || features.leaderboard === true) &&
      (view !== 'podium' || features.leaderboard === true) &&
      (view !== 'feedback' || features.feedback === true) &&
      (view !== 'comments' || features.comments === true),
  );
}

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
 * The room count on the big screen: everyone, the secretariat included (they
 * are welcomed on the arrivals wall too; only the leaderboard and the lucky
 * draw leave them out).
 */
export function guestCount(
  attendees: { id: string; isSecretariat: boolean }[],
  checkedInIds: Iterable<string>,
): { arrived: number; expected: number } {
  const guests = new Set(attendees.map((a) => a.id));
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
    .slice(0, Math.max(0, limit))
    .map((row) => ({ key: row.id, name: row.attendee.name, department: row.attendee.department }));
}

/** "14:05" from minutes after midnight, for the corner clock. */
export function clockFromMinutes(minutes: number): string {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/**
 * The arrivals milestone reached so far, for a short celebration on the
 * screen: a quarter, half, three quarters, everyone. Null below a quarter.
 */
export function arrivalMilestone(percent: number): { at: number; text: string } | null {
  if (percent >= 100) return { at: 100, text: 'Everyone is here! 🎉' };
  if (percent >= 75) return { at: 75, text: 'Three quarters of us are here' };
  if (percent >= 50) return { at: 50, text: 'Halfway there!' };
  if (percent >= 25) return { at: 25, text: 'A quarter of us are here' };
  return null;
}

/* ------------------------------------------------------------------ podium */

export const PODIUM_SIZES = [3, 5, 10] as const;
export type PodiumSize = (typeof PODIUM_SIZES)[number];

export function parsePodiumSize(value: unknown): PodiumSize {
  const n = Number(value);
  return (PODIUM_SIZES as readonly number[]).includes(n) ? (n as PodiumSize) : 3;
}

export type PodiumGroup<T> = { rank: number; points: number; people: T[] };

/**
 * The places on the podium. Equal points share a place, so a tie at the
 * cut-off shows everyone tied rather than dropping someone by luck: the top 3
 * with two people tied for 3rd shows four names. Places run best first.
 */
export function podiumGroups<T extends { rank: number; points: number }>(
  rows: T[],
  size: number,
): PodiumGroup<T>[] {
  const groups: PodiumGroup<T>[] = [];
  for (const row of rows) {
    if (row.rank > size) continue;
    const last = groups[groups.length - 1];
    if (last && last.rank === row.rank) last.people.push(row);
    else groups.push({ rank: row.rank, points: row.points, people: [row] });
  }
  return groups;
}

/** Places shown so far: clamped, so a stale step never overruns. */
export function clampPodiumStep(step: number, groups: number): number {
  if (!Number.isFinite(step)) return 0;
  return Math.max(0, Math.min(groups, Math.floor(step)));
}
