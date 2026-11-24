/** An attendee answers the open poll (Module 3). One answer per phone. */
import { getData } from '@/data';
import { getEventConfig } from '@/lib/config';
import { LIMITS, rateLimit } from '@/lib/rate-limit';
import { plainText } from '@/lib/text';
import { deviceIdOrNew, readBackupMode, respond } from '@/modules/backup/server';
import { MAX_WORD, POLL_VOTER_PREFIX, validateVote } from '@/modules/polls/logic';

export async function POST(request: Request): Promise<Response> {
  const config = getEventConfig();
  const form = await request.formData().catch(() => null);
  if (!form || !config.features.polls || !(await readBackupMode())) {
    return respond(request, '/', 'closed', false, 403);
  }

  const deviceId = await deviceIdOrNew();
  if (!rateLimit(`poll-vote:${deviceId}`, LIMITS.pollVote).allowed) {
    return respond(request, '/poll', 'slow-down', false, 429);
  }

  const data = getData();
  // Nothing is anonymous: a vote carries the name this phone signed in with.
  const ownerId = await data.players.ownerOf(deviceId);
  const owner = ownerId ? await data.attendees.get(ownerId) : null;
  if (!owner) return respond(request, '/poll', 'who', false, 401);
  const poll = await data.polls.get(plainText(form.get('pollId'), 64));
  if (!poll) return respond(request, '/poll', 'closed', false, 404);

  const checked = validateVote(poll, {
    choices: form.getAll('choice').map((v) => plainText(v, 8)),
    word: plainText(form.get('word'), MAX_WORD + 1),
  });
  if (!checked.ok) return respond(request, '/poll', checked.problem, false);

  const { duplicate } = await data.polls.vote(poll.id, deviceId, checked.choices);
  if (!duplicate) {
    await data.settings.set(
      `${POLL_VOTER_PREFIX}${poll.id}.${deviceId}`,
      JSON.stringify({ id: owner.id, name: owner.name }),
    );
  }
  return respond(request, '/poll', duplicate ? 'already' : 'voted', true);
}
