/**
 * Module 1 logic: turning the config file into an agenda, and working out
 * what is happening now and what is next.
 *
 * Pure functions only, no React and no data access, so the awkward parts
 * (midnight, a day that is not an event day, two breakouts at once) can be
 * tested directly. See logic.test.ts.
 */
import type { Day, EventConfig, Session, SlidoRef, Speaker } from '@/lib/event-schema';
import { toMinutes, type EventNow } from '@/lib/time';

export type SessionStatus = 'past' | 'live' | 'upcoming';

/** A session with everything a page needs already attached. */
export type ResolvedSession = Session & {
  dayId: string;
  dayLabel: string;
  date: string;
  startMinutes: number;
  endMinutes: number;
  /** Full speaker records, in the order the session lists them. */
  speakers: Speaker[];
  /** The session override, else the event wide Slido, else null. */
  slidoLink: SlidoRef | null;
};

export type ResolvedDay = Omit<Day, 'sessions'> & {
  sessions: ResolvedSession[];
};

export type Agenda = {
  days: ResolvedDay[];
  /** Every visible session, in time order across all days. */
  sessions: ResolvedSession[];
  /** Includes hidden sessions, so a pre-announcement link still works. */
  byId: Map<string, ResolvedSession>;
  speakersById: Map<string, Speaker>;
};

function compareSessions(a: ResolvedSession, b: ResolvedSession): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  if (a.startMinutes !== b.startMinutes) return a.startMinutes - b.startMinutes;
  if (a.endMinutes !== b.endMinutes) return a.endMinutes - b.endMinutes;
  return a.title.localeCompare(b.title);
}

/**
 * Reads the config once and produces everything the schedule pages need.
 *
 * Hidden sessions are left out of the day lists and the flat list, but stay
 * in byId, so a link can be shared before a session is announced.
 */
export function buildAgenda(config: EventConfig): Agenda {
  const speakersById = new Map(config.speakers.map((speaker) => [speaker.id, speaker]));
  const globalSlido = config.integrations.slido;
  const byId = new Map<string, ResolvedSession>();

  const days: ResolvedDay[] = config.days
    .map((day) => {
      const sessions = day.sessions.map((session): ResolvedSession => {
        const resolved: ResolvedSession = {
          ...session,
          dayId: day.id,
          dayLabel: day.label,
          date: day.date,
          startMinutes: toMinutes(session.start),
          endMinutes: toMinutes(session.end),
          speakers: session.speakerIds
            .map((speakerId) => speakersById.get(speakerId))
            .filter((speaker): speaker is Speaker => speaker !== undefined),
          slidoLink:
            session.slido ?? (globalSlido?.enabled === true ? toSlidoRef(globalSlido) : null),
        };
        byId.set(resolved.id, resolved);
        return resolved;
      });

      return {
        ...day,
        sessions: sessions.filter((session) => !session.hidden).sort(compareSessions),
      };
    })
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  const sessions = days.flatMap((day) => day.sessions).sort(compareSessions);

  return { days, sessions, byId, speakersById };
}

/** Drops the "enabled" flag, which pages do not need once it is resolved. */
function toSlidoRef(value: SlidoRef & { enabled: boolean }): SlidoRef {
  return { eventUrl: value.eventUrl, eventCode: value.eventCode, label: value.label };
}

/** Past, happening now, or still to come. */
export function sessionStatus(
  session: Pick<ResolvedSession, 'date' | 'startMinutes' | 'endMinutes'>,
  now: EventNow,
): SessionStatus {
  if (now.date < session.date) return 'upcoming';
  if (now.date > session.date) return 'past';
  if (now.minutes < session.startMinutes) return 'upcoming';
  // A session that ends exactly now has finished.
  if (now.minutes >= session.endMinutes) return 'past';
  return 'live';
}

export type NowAndNext = {
  /** The event day matching today's date, or null outside the event. */
  today: ResolvedDay | null;
  /**
   * The day the home page should show. Today during the event, the first day
   * before it starts, the last day after it ends. Never null when the config
   * has at least one day, so the page is never empty.
   */
  focusDay: ResolvedDay | null;
  /** Everything happening now. More than one during parallel breakouts. */
  live: ResolvedSession[];
  /** The next session to start, which may be on a later day. */
  next: ResolvedSession | null;
  /** How many minutes until "next" starts, when it is on the same day. */
  minutesUntilNext: number | null;
  beforeEventStarts: boolean;
  afterEventEnds: boolean;
};

/**
 * The "now and next" highlight, used on the home page and later on the big
 * screen. Works for any moment, including gaps between sessions and dates
 * outside the event.
 */
export function findNowAndNext(agenda: Agenda, now: EventNow): NowAndNext {
  const today = agenda.days.find((day) => day.date === now.date) ?? null;
  const live = agenda.sessions.filter((session) => sessionStatus(session, now) === 'live');

  const next =
    agenda.sessions.find((session) => sessionStatus(session, now) === 'upcoming') ?? null;

  const first = agenda.sessions[0] ?? null;
  const last = agenda.sessions[agenda.sessions.length - 1] ?? null;

  const beforeEventStarts =
    first !== null &&
    (now.date < first.date || (now.date === first.date && now.minutes < first.startMinutes));

  const afterEventEnds =
    last !== null &&
    (now.date > last.date || (now.date === last.date && now.minutes >= last.endMinutes));

  const focusDay =
    today ??
    (beforeEventStarts ? (agenda.days[0] ?? null) : (agenda.days[agenda.days.length - 1] ?? null));

  const minutesUntilNext =
    next !== null && next.date === now.date ? next.startMinutes - now.minutes : null;

  return {
    today,
    focusDay,
    live,
    next,
    minutesUntilNext,
    beforeEventStarts,
    afterEventEnds,
  };
}

/** Sessions worth putting on a "what is on" list: everything except filler. */
export function isProgrammeSession(session: ResolvedSession): boolean {
  return session.type !== 'break' && session.type !== 'logistics';
}

/** Which day tab to open on the agenda page. */
export function resolveSelectedDay(
  agenda: Agenda,
  requestedDayId: string | null,
  now: EventNow,
): ResolvedDay | null {
  if (requestedDayId !== null) {
    const requested = agenda.days.find((day) => day.id === requestedDayId);
    if (requested) return requested;
  }
  return findNowAndNext(agenda, now).focusDay;
}

/** Plain English label for a session type, for the small badge on a card. */
export function sessionTypeLabel(type: Session['type']): string {
  switch (type) {
    case 'talk':
      return 'Talk';
    case 'panel':
      return 'Panel';
    case 'breakout':
      return 'Breakout';
    case 'activity':
      return 'Activity';
    case 'break':
      return 'Break';
    case 'meal':
      return 'Meal';
    case 'logistics':
      return 'Logistics';
    default: {
      const unreachable: never = type;
      return String(unreachable);
    }
  }
}

/** "in 25 minutes", "in 1 hour 10 minutes", "now". Used by the next card. */
export function formatMinutesUntil(minutes: number): string {
  if (minutes <= 0) return 'now';
  if (minutes < 60) return `in ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const hourPart = `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
  if (rest === 0) return `in ${hourPart}`;
  return `in ${hourPart} ${rest} ${rest === 1 ? 'minute' : 'minutes'}`;
}

/**
 * Keeps a dev time override attached as you move between pages, so you can
 * click through the whole portal as if it were Day 2 at 11 am.
 * Returns "" in normal use, which adds nothing to the links.
 */
export function nowLinkSuffix(now: EventNow, separator: '?' | '&' = '?'): string {
  if (!now.isOverride) return '';
  const clock = `${String(Math.floor(now.minutes / 60)).padStart(2, '0')}:${String(
    now.minutes % 60,
  ).padStart(2, '0')}`;
  return `${separator}now=${encodeURIComponent(`${now.date}T${clock}`)}`;
}

/** Reads the ?now= parameter, which Next gives us as string or string[]. */
export function readNowParam(value: string | string[] | undefined): string | null {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value[0] ?? null;
  return null;
}
