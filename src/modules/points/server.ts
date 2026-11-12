/**
 * Gathers what the points are worked out from, and who this phone is.
 * See logic.ts for the rules.
 */
import { getData, type Attendee } from '@/data';
import { getEventConfig } from '@/lib/config';
import { localDateTimeToInstant } from '@/lib/time';
import { currentDeviceId } from '@/modules/backup/server';

import {
  computeScores,
  rankDepartments,
  rankPeople,
  type DepartmentRow,
  type PersonRow,
  type Score,
  type ScoreSources,
} from './logic';

export type Scoreboard = {
  scores: Map<string, Score>;
  people: PersonRow[];
  departments: DepartmentRow[];
};

/** Everything at once. A few small queries: the whole event is a few hundred rows. */
export async function loadScoreboard(): Promise<Scoreboard> {
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
  const voteLists = await Promise.all(polls.map((poll) => data.polls.votes(poll.id)));

  const dayStarts: ScoreSources['dayStarts'] = {};
  for (const day of config.days) {
    const first = [...day.sessions].map((s) => s.start).sort()[0];
    const instant = first
      ? localDateTimeToInstant(`${day.date}T${first}`, config.event.timezone)
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
  });

  return {
    scores,
    people: rankPeople(scores, attendees),
    departments: rankDepartments(scores, attendees),
  };
}

/** The person this phone is signed in as, or null. */
export async function currentPlayer(): Promise<Attendee | null> {
  const deviceId = await currentDeviceId();
  if (!deviceId) return null;
  const data = getData();
  const attendeeId = await data.players.ownerOf(deviceId);
  return attendeeId ? data.attendees.get(attendeeId) : null;
}
