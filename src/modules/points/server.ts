/**
 * Gathers what the points are worked out from, and who this device is.
 * See logic.ts for the rules.
 */
import { cache } from 'react';

import { getData, type Attendee } from '@/data';
import { getEventConfig } from '@/lib/config';
import { isDivision } from '@/lib/departments';
import { localDateTimeToInstant } from '@/lib/time';
import { currentDeviceId } from '@/modules/backup/server';

import {
  BONUS_KEY,
  computeScores,
  parseBonus,
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
  const bonusRaw = await data.settings.get(BONUS_KEY);
  const [voteLists, reactions, comments] = await Promise.all([
    Promise.all(polls.map((poll) => data.polls.votes(poll.id))),
    config.features.reactions ? data.reactions.participation() : Promise.resolve([]),
    config.features.comments ? data.comments.listApproved() : Promise.resolve([]),
  ]);

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
    reactions,
    comments: comments.map((c) => ({ id: c.id, deviceId: c.deviceId })),
    bonus: parseBonus(bonusRaw),
  });

  return {
    scores,
    people: rankPeople(scores, attendees),
    // The division (D&I) is over the departments, so it is not ranked as one.
    departments: rankDepartments(
      scores,
      attendees.filter((a) => !isDivision(config, a.department)),
    ),
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
