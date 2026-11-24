/** Someone posts a comment on a talk. It waits for approval. */
import { getData } from '@/data';
import { getEventConfig } from '@/lib/config';
import { LIMITS, rateLimit } from '@/lib/rate-limit';
import { multilineText, plainText } from '@/lib/text';
import { deviceIdOrNew } from '@/modules/backup/server';
import {
  COMMENT_KEYS,
  commentsNeedApproval,
  MAX_COMMENT,
  MAX_COMMENT_NAME,
  validateComment,
} from '@/modules/talk/logic';
import { backToComments, findSession } from '@/modules/talk/server';
import { after } from 'next/server';
import { notifyTeamWaiting } from '@/modules/announce/team';

export async function POST(request: Request): Promise<Response> {
  const config = getEventConfig();
  const form = await request.formData().catch(() => null);
  const sessionId = plainText(form?.get('sessionId'), 64);
  const now = plainText(form?.get('now'), 20) || null;

  if (!form || !config.features.comments || !findSession(sessionId)) {
    return Response.json({ ok: false, state: 'closed' }, { status: 403 });
  }

  const deviceId = await deviceIdOrNew();
  if (!rateLimit(`comment:${deviceId}`, LIMITS.comment).allowed) {
    return backToComments(sessionId, 'slow-down', now);
  }

  // One more than the limit, so "too long" is reported rather than cut off.
  const text = multilineText(form.get('text'), MAX_COMMENT + 1).replace(/\s*\n\s*/g, ' ');
  const data = getData();
  // Nothing anonymous: the comment carries the name this phone signed in with.
  const ownerId = await data.players.ownerOf(deviceId);
  const owner = ownerId ? await data.attendees.get(ownerId) : null;
  if (!owner) return backToComments(sessionId, 'who', now);
  const checked = validateComment({
    text,
    alreadyPosted: await data.comments.countByDevice(sessionId, deviceId),
  });
  if (!checked.ok) return backToComments(sessionId, checked.problem, now);

  const waits = commentsNeedApproval(await data.settings.get(COMMENT_KEYS.approval));
  await data.comments.add({
    sessionId,
    text: text.trim(),
    status: waits ? 'pending' : 'approved',
    name: owner.name.slice(0, MAX_COMMENT_NAME),
    deviceId,
  });
  if (waits) after(() => notifyTeamWaiting('comment').catch(() => undefined));
  return backToComments(sessionId, waits ? 'posted' : 'live', now);
}
