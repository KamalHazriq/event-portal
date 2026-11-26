/**
 * Gathers what the points are worked out from, and who this device is.
 * See logic.ts for the rules.
 */
import { cache } from 'react';

import { getData, type Attendee } from '@/data';
import { getEventConfig } from '@/lib/config';
import { localDateTimeToInstant } from '@/lib/time';
import { currentDeviceId } from '@/modules/backup/server';

import {
  BONUS_KEY,
  EARLY_KEY,
  earlyLocalDateTime,
  parseEarlyCutoffs,
  computeScores,
  parseBonus,
  rankPeople,
  type PersonRow,
  type Score,
  type ScoreSources,
} from './logic';

export type Scoreboard = {
  scores: Map<string, Score>;
  people: PersonRow[];
};

// The projector, the podium and the admin page all ask for this every few
// seconds, and it is a dozen queries: kept for a moment so they share one.
const SCOREBOARD_TTL_MS = 2_500;
let kept: { at: number; value: Scoreboard } | null = null;

/** Call after a change to points the secretariat makes by hand, so it shows at once. */
export function forgetScoreboard(): void {
  kept = null;
}

/** Everything at once. A few small queries: the whole event is a few hundred rows. */
export async function loadScoreboard(options: { shared?: boolean } = {}): Promise<Scoreboard> {
  // Only the projector and the admin controls share a recent copy. Anything a
  // person has just done (joining, checking in) reads fresh.
  if (options.shared && kept && Date.now() - kept.at < SCOREBOARD_TTL_MS) return kept.value;
  const value = await computeScoreboard();
  kept = { at: Date.now(), value };
  return value;
}

async function computeScoreboard(): Promise<Scoreboard> {
  const config = getEventConfig();
  const data = getData();

  const qaSessions = config.days.flatMap((d) => d.sessions).filter((s) => s.qaEnabled);
  const [attendees, links, checkInsByDay, feedback, polls, photos, questionLists] =
    await Promise.all([
      data.attendees.list(),
      data.players.links(),
      Promise.all(config.days.map((day) => data.checkIns.listByDay(day.id))),
      config.features.feedback ? data.feedback.listAll() : Promise.resolve([]),
      config.features.polls ? data.polls.list() : Promise.resolve([]),
      config.features.photoWall ? data.photos.list('approved') : Promise.resolve([]),
      config.features.qa
        ? Promise.all(qaSessions.map((s) => data.questions.listBySession(s.id)))
        : Promise.resolve([]),
    ]);
  const bonusRaw = await data.settings.get(BONUS_KEY);
  const [voteLists, reactions, comments] = await Promise.all([
    Promise.all(polls.map((poll) => data.polls.votes(poll.id))),
    config.features.reactions ? data.reactions.participation() : Promise.resolve([]),
    config.features.comments ? data.comments.listApproved() : Promise.resolve([]),
  ]);

  const cutoffs = parseEarlyCutoffs(await data.settings.get(EARLY_KEY));
  const dayStarts: ScoreSources['dayStarts'] = {};
  for (const day of config.days) {
    // The secretariat's own cut-off for the day, else the day's first session.
    const first = cutoffs[day.id] ?? [...day.sessions].map((s) => s.start).sort()[0];
    const instant = first
      ? localDateTimeToInstant(earlyLocalDateTime(day.date, first), config.event.timezone)
      : null;
    dayStarts[day.id] = instant?.toISOString();
  }

  const scores = computeScores({
    links,
    checkIns: checkInsByDay.flat().map((c) => ({
      attendeeId: c.attendeeId,
      dayId: c.dayId,
      at: c.at,
    })),
    dayStarts,
    feedback: feedback.map((f) => ({
      formId: f.formId,
      deviceId: f.deviceId,
      attendeeId: f.attendeeId,
    })),
    pollVotes: voteLists.flat().map((v) => ({ pollId: v.pollId, deviceId: v.deviceId })),
    photos: photos.map((p) => ({ id: p.id, deviceId: p.deviceId })),
    questions: questionLists
      .flat()
      .filter((q) => q.status !== 'hidden')
      .map((q) => ({ id: q.id, deviceId: q.deviceId })),
    reactions,
    comments: comments.map((c) => ({ id: c.id, deviceId: c.deviceId })),
    bonus: parseBonus(bonusRaw),
  });

  return {
    scores,
    people: rankPeople(scores, attendees),
  };
}

/** The person this device is signed in as, or null. */
// Asked by the page, the banners and the name check alike: looked up once
// per request, not once per asker.
export const currentPlayer = cache(async (): Promise<Attendee | null> => {
  const deviceId = await currentDeviceId();
  if (!deviceId) return null;
  const data = getData();
  const attendeeId = await data.players.ownerOf(deviceId);
  return attendeeId ? data.attendees.get(attendeeId) : null;
});

/** The moment before which a scan on this day counts as early, or null. */
export async function earlyInstantFor(dayId: string): Promise<Date | null> {
  const config = getEventConfig();
  const day = config.days.find((d) => d.id === dayId);
  if (!day) return null;
  const cutoffs = parseEarlyCutoffs(await getData().settings.get(EARLY_KEY));
  const first = cutoffs[day.id] ?? [...day.sessions].map((s) => s.start).sort()[0];
  return first
    ? localDateTimeToInstant(earlyLocalDateTime(day.date, first), config.event.timezone)
    : null;
}

/** What each day's attendance is worth, for the points pages. */
export async function attendanceRules(): Promise<
  {
    dayId: string;
    label: string;
    date: string;
    earlyBy: string;
    defaultEarlyBy: string;
    early: number;
    late: number;
  }[]
> {
  const config = getEventConfig();
  const data = getData();
  const cutoffs = parseEarlyCutoffs(await data.settings.get(EARLY_KEY));
  return Promise.all(
    config.days.map(async (day) => {
      const first = [...day.sessions].map((s) => s.start).sort()[0] ?? '09:00';
      const before = await earlyInstantFor(day.id);
      const scans = await data.checkIns.listByDay(day.id).catch(() => []);
      const early = before ? scans.filter((c) => Date.parse(c.at) < before.getTime()).length : 0;
      return {
        dayId: day.id,
        label: day.label,
        date: day.date,
        earlyBy: earlyLocalDateTime(day.date, cutoffs[day.id] ?? first),
        defaultEarlyBy: earlyLocalDateTime(day.date, first),
        early,
        late: scans.length - early,
      };
    }),
  );
}
