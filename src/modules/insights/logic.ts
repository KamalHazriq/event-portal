/**
 * Insights: the live numbers turned into a short list of things to do.
 *
 * Every alert comes from a plain rule written below (a threshold on a count
 * or a rate), so the secretariat can see why it appeared. Nothing here is
 * machine learning, and the page says so.
 */
import type { Attendee, CheckIn, Comment, DeviceLink, FeedbackEntry, Photo } from '@/data/types';
import type { EventConfig } from '@/lib/event-schema';
import { compareMoments, fromMinutes, toMinutes, type EventNow } from '@/lib/time';
import { EVENT_FORM_ID } from '@/modules/feedback/logic';

export type Phase = 'before' | 'during' | 'after';

export type InsightsInput = {
  config: EventConfig;
  attendees: Attendee[];
  checkIns: CheckIn[];
  feedback: FeedbackEntry[];
  photos: Photo[];
  /** One row per phone per session that reacted. */
  reactions: { sessionId: string; deviceId: string }[];
  /** Every comment, any status. */
  comments: Comment[];
  links: DeviceLink[];
  /** Whether photos wait for approval. */
  photosModerated: boolean;
  now: EventNow;
};

function sortedDays(config: EventConfig) {
  return [...config.days].sort((a, b) => (a.date < b.date ? -1 : 1));
}

/** Before the first day, during the three days, or after the last session ends. */
export function eventPhase(config: EventConfig, now: EventNow): Phase {
  const days = sortedDays(config);
  const first = days[0];
  const last = days[days.length - 1];
  if (!first || !last) return 'before';
  if (now.date < first.date) return 'before';
  const lastEnd = Math.max(...last.sessions.map((s) => toMinutes(s.end)));
  if (compareMoments(now, { date: last.date, minutes: lastEnd }) > 0) return 'after';
  return 'during';
}

/* ---------------------------------------------------------------- arrivals */

export type ArrivalBucket = { start: string; end: string; count: number };

/** Minutes since midnight in the event's time zone. */
function localMinutes(iso: string, timezone: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return get('hour') * 60 + get('minute');
}

/**
 * Check ins counted per window (15 minutes by default), from the first
 * arrival's window to the last, with empty windows kept so gaps show.
 */
export function arrivalBuckets(
  checkIns: Pick<CheckIn, 'at'>[],
  timezone: string,
  size = 15,
): ArrivalBucket[] {
  if (checkIns.length === 0) return [];
  const slots = checkIns.map((c) => Math.floor(localMinutes(c.at, timezone) / size));
  const lo = Math.min(...slots);
  const hi = Math.max(...slots);
  const counts = new Map<number, number>();
  for (const s of slots) counts.set(s, (counts.get(s) ?? 0) + 1);
  const out: ArrivalBucket[] = [];
  for (let s = lo; s <= hi; s++) {
    out.push({
      start: fromMinutes(s * size),
      end: fromMinutes(Math.min((s + 1) * size, 24 * 60 - 1)),
      count: counts.get(s) ?? 0,
    });
  }
  return out;
}

/** The busiest window. The earliest wins a tie. */
export function peakBucket(buckets: ArrivalBucket[]): ArrivalBucket | null {
  let best: ArrivalBucket | null = null;
  for (const b of buckets) if (!best || b.count > best.count) best = b;
  return best && best.count > 0 ? best : null;
}

/* -------------------------------------------------------------- engagement */

export type SessionEngagement = {
  sessionId: string;
  title: string;
  dayLabel: string;
  start: string;
  /** Phones that sent at least one reaction. */
  reactors: number;
  comments: number;
  ratings: number;
  average: number | null;
  /** reactors + comments + ratings: a rough "how lively" number for sorting. */
  score: number;
};

const ENGAGING_TYPES = new Set(['talk', 'panel', 'breakout', 'activity']);

export function engagementBySession(input: InsightsInput): SessionEngagement[] {
  const reactors = new Map<string, Set<string>>();
  for (const r of input.reactions) {
    const set = reactors.get(r.sessionId) ?? new Set<string>();
    set.add(r.deviceId);
    reactors.set(r.sessionId, set);
  }
  const rows: SessionEngagement[] = [];
  for (const day of sortedDays(input.config)) {
    for (const s of day.sessions) {
      if (s.hidden || !ENGAGING_TYPES.has(s.type)) continue;
      const ratings = input.feedback.filter((f) => f.formId === s.id);
      const stars = ratings.filter((f) => f.rating !== null).map((f) => f.rating as number);
      const comments = input.comments.filter(
        (c) => c.sessionId === s.id && c.status !== 'hidden',
      ).length;
      const r = reactors.get(s.id)?.size ?? 0;
      rows.push({
        sessionId: s.id,
        title: s.title,
        dayLabel: day.label,
        start: s.start,
        reactors: r,
        comments,
        ratings: ratings.length,
        average:
          stars.length === 0
            ? null
            : Math.round((stars.reduce((a, b) => a + b, 0) / stars.length) * 10) / 10,
        score: r + comments + ratings.length,
      });
    }
  }
  return rows;
}

/** Phones that did anything: reacted, commented, shared a photo or gave feedback. */
export function phonesTakingPart(input: InsightsInput): number {
  const ids = new Set<string>();
  for (const r of input.reactions) ids.add(r.deviceId);
  for (const c of input.comments) ids.add(c.deviceId);
  for (const p of input.photos) ids.add(p.deviceId);
  for (const f of input.feedback) if (f.deviceId) ids.add(f.deviceId);
  for (const l of input.links) ids.add(l.deviceId);
  ids.delete('');
  return ids.size;
}

/* ------------------------------------------------------------------ alerts */

export type AlertTone = 'act' | 'note' | 'good';
export type Alert = { tone: AlertTone; text: string; href?: string; action?: string };

/** The rules. Each is a plain threshold; see the comments for why. */
export function buildAlerts(input: InsightsInput): Alert[] {
  const { config, attendees, checkIns, now } = input;
  const tz = config.event.timezone;
  const phase = eventPhase(config, now);
  const alerts: Alert[] = [];
  const guests = attendees.filter((a) => !a.isSecretariat);

  // Nothing works without the list: name tags, check in, headcount.
  if (attendees.length === 0) {
    alerts.push({
      tone: 'act',
      text: 'No participants loaded yet. Name tags, check in and headcount all need the list.',
      href: '/admin/attendees',
      action: 'Upload the list',
    });
  }

  // Department drives the headcount by department and the leaderboard.
  const noDept = guests.filter((a) => !a.department.trim()).length;
  if (noDept > 0) {
    alerts.push({
      tone: 'note',
      text: `${noDept} ${noDept === 1 ? 'guest has' : 'guests have'} no department, so they will not count on the department leaderboard.`,
      href: '/admin/attendees',
      action: 'Check the list',
    });
  }

  const today = config.days.find((d) => d.date === now.date);
  const todayIds = new Set(
    today ? checkIns.filter((c) => c.dayId === today.id).map((c) => c.attendeeId) : [],
  );
  const guestIds = new Set(guests.map((g) => g.id));
  const guestsToday = [...todayIds].filter((id) => guestIds.has(id)).length;

  if (today && phase === 'during' && guests.length > 0) {
    const firstStart = Math.min(...today.sessions.map((s) => toMinutes(s.start)));
    // Half an hour after things start, most people should be in.
    if (now.minutes >= firstStart + 30 && guestsToday / guests.length < 0.7) {
      alerts.push({
        tone: 'act',
        text: `${guests.length - guestsToday} of ${guests.length} guests are not checked in yet today.`,
        href: '/admin/headcount',
        action: 'See who is missing',
      });
    }

    // A whole department missing usually means a bus or a clash, not stragglers.
    if (guestsToday >= 10) {
      const missingDepts = [...new Set(guests.map((g) => g.department).filter(Boolean))].filter(
        (dept) => !guests.some((g) => g.department === dept && todayIds.has(g.id)),
      );
      if (missingDepts.length > 0) {
        const named = missingDepts.slice(0, 3).join(', ');
        const more = missingDepts.length > 3 ? ` and ${missingDepts.length - 3} more` : '';
        alerts.push({
          tone: 'note',
          text: `Nobody from ${named}${more} has checked in today.`,
          href: '/admin/headcount',
          action: 'Open headcount',
        });
      }
    }

    // Ratings are easiest to get in the room, right after the talk.
    if (guestsToday >= 10) {
      const ended = today.sessions.filter(
        (s) => s.feedbackEnabled && !s.hidden && toMinutes(s.end) <= now.minutes,
      );
      const latest = ended[ended.length - 1];
      if (latest) {
        const count = input.feedback.filter((f) => f.formId === latest.id).length;
        if (count < guestsToday * 0.2) {
          alerts.push({
            tone: 'note',
            text: `Only ${count} ${count === 1 ? 'rating' : 'ratings'} for "${latest.title}". Ask the emcee to remind the room before the next talk.`,
          });
        }
      }
    }

    // Phones that have reacted, commented or shared, against people in the room.
    const taking = phonesTakingPart(input);
    if (guestsToday >= 20 && taking / guestsToday < 0.3) {
      alerts.push({
        tone: 'note',
        text: `Only ${taking} phones have taken part so far. Put the reactions or photo QR on the big screen between talks.`,
        href: '/admin/big-screen',
        action: 'Big screen',
      });
    }
  }

  const waitingPhotos = input.photos.filter((p) => p.status === 'pending').length;
  if (waitingPhotos > 0) {
    alerts.push({
      tone: 'act',
      text:
        waitingPhotos >= 10
          ? `${waitingPhotos} photos waiting for approval. If the team is busy, turn approval off for a while.`
          : `${waitingPhotos} ${waitingPhotos === 1 ? 'photo is' : 'photos are'} waiting for approval.`,
      href: '/admin/photos',
      action: 'Review photos',
    });
  }

  const waitingComments = input.comments.filter((c) => c.status === 'pending').length;
  if (waitingComments > 0) {
    alerts.push({
      tone: 'act',
      text: `${waitingComments} ${waitingComments === 1 ? 'comment is' : 'comments are'} waiting for a check.`,
      href: '/admin/comments',
      action: 'Review comments',
    });
  }

  // The busiest quarter hour tells the desk when to be fully staffed.
  if (today) {
    const peak = peakBucket(
      arrivalBuckets(
        checkIns.filter((c) => c.dayId === today.id),
        tz,
      ),
    );
    if (peak && peak.count >= 5) {
      alerts.push({
        tone: 'good',
        text: `Busiest arrivals today: ${peak.count} people between ${peak.start} and ${peak.end}. Have every desk open for that window tomorrow.`,
      });
    }
  }

  if (phase === 'after') {
    const attended = new Set(
      checkIns.filter((c) => guestIds.has(c.attendeeId)).map((c) => c.attendeeId),
    ).size;
    const answers = input.feedback.filter((f) => f.formId === EVENT_FORM_ID).length;
    if (attended > 0 && answers / attended < 0.3) {
      alerts.push({
        tone: 'act',
        text: `Event feedback from ${answers} of ${attended} guests who came. Send a reminder with the feedback link.`,
        href: '/admin/feedback',
        action: 'Feedback',
      });
    }
  }

  const liveliest = engagementBySession(input)
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)[0];
  if (liveliest && liveliest.score >= 10) {
    alerts.push({
      tone: 'good',
      text: `Liveliest session so far: "${liveliest.title}" (${liveliest.reactors} phones reacted, ${liveliest.comments} comments, ${liveliest.ratings} ratings).`,
    });
  }

  const order: Record<AlertTone, number> = { act: 0, note: 1, good: 2 };
  return alerts.sort((a, b) => order[a.tone] - order[b.tone]);
}
