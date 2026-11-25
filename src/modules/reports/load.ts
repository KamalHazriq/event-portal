/**
 * Reads everything the report needs, through the data adapter. Server only.
 */
import { POLL_VOTER_PREFIX } from '@/modules/polls/logic';
import { getData } from '@/data';
import { getEventConfig } from '@/lib/config';

import type { ReportInput } from './logic';

export async function loadReportInput(generatedAt = new Date()): Promise<ReportInput> {
  const config = getEventConfig();
  const data = getData();

  const [attendees, perDay, feedback, summaries, imports, luckyDraw, photos] = await Promise.all([
    data.attendees.list(),
    Promise.all(config.days.map((day) => data.checkIns.listByDay(day.id))),
    data.feedback.listAll(),
    data.feedback.summaries(),
    data.imports.list('slido'),
    data.luckyDraw.list(),
    data.photos.list(),
  ]);

  // The backup Q&A and polls: usually empty, since Slido runs them.
  const qaSessions = config.days.flatMap((d) => d.sessions).filter((s) => s.qaEnabled);
  const [questionLists, pollList] = await Promise.all([
    Promise.all(qaSessions.map((s) => data.questions.listBySession(s.id))),
    data.polls.list(),
  ]);
  // Who cast each vote: kept as settings rows when the vote came in.
  const pollVoters: Record<string, string> = {};
  for (const row of await data.settings.getAll()) {
    if (!row.key.startsWith(POLL_VOTER_PREFIX)) continue;
    try {
      pollVoters[row.key.slice(POLL_VOTER_PREFIX.length)] = (
        JSON.parse(row.value) as { name: string }
      ).name;
    } catch {
      // A damaged row is skipped.
    }
  }
  const pollsWithVotes = await Promise.all(
    pollList.map(async (poll) => ({ poll, votes: await data.polls.votes(poll.id) })),
  );

  return {
    config,
    questions: questionLists.flat(),
    polls: pollsWithVotes,
    comments: await data.comments.listAll(),
    pollVoters,
    attendees,
    // listByDay carries the person too; the report only needs the check in.
    checkIns: perDay.flat().map(({ attendee: _attendee, ...checkIn }) => checkIn),
    feedback,
    summaries,
    imports,
    luckyDraw,
    photos: {
      approved: photos.filter((p) => p.status === 'approved').length,
      total: photos.length,
    },
    generatedAt,
  };
}
