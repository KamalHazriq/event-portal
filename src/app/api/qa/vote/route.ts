/** An attendee upvotes a question. One vote per phone per question. */
import { getData } from '@/data';
import { getEventConfig } from '@/lib/config';
import { LIMITS, rateLimit } from '@/lib/rate-limit';
import { plainText } from '@/lib/text';
import { deviceIdOrNew, readBackupMode, respond } from '@/modules/backup/server';
import { isPublic } from '@/modules/qa/logic';

export async function POST(request: Request): Promise<Response> {
  const config = getEventConfig();
  const form = await request.formData().catch(() => null);
  const sessionId = plainText(form?.get('sessionId'), 64);
  const questionId = plainText(form?.get('questionId'), 64);
  const page = `/qa/${encodeURIComponent(sessionId)}`;

  if (!form || !config.features.qa || !(await readBackupMode())) {
    return respond(request, '/', 'closed', false, 403);
  }

  const deviceId = await deviceIdOrNew();
  if (!rateLimit(`qa-vote:${deviceId}`, LIMITS.qaVote).allowed) {
    return respond(request, page, 'slow-down', false, 429);
  }

  const data = getData();
  // Only a question the room can see can be voted for, so a vote can never
  // reveal that a hidden question exists.
  const question = (await data.questions.listBySession(sessionId)).find((q) => q.id === questionId);
  if (!question || !isPublic(question)) return respond(request, page, 'gone', false, 404);

  const counted = await data.questions.vote(questionId, deviceId);
  return respond(request, page, counted ? 'voted' : 'already', true);
}
