/** Someone posts a comment on a talk. It waits for approval. */
import { getData } from '@/data';
import { getEventConfig } from '@/lib/config';
import { LIMITS, rateLimit } from '@/lib/rate-limit';
import { multilineText, plainText } from '@/lib/text';
import { deviceIdOrNew } from '@/modules/backup/server';
import { MAX_COMMENT, MAX_COMMENT_NAME, validateComment } from '@/modules/talk/logic';
import { backToComments, findSession } from '@/modules/talk/server';

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
  const checked = validateComment({
    text,
    alreadyPosted: await data.comments.countByDevice(sessionId, deviceId),
  });
  if (!checked.ok) return backToComments(sessionId, checked.problem, now);

  await data.comments.add({
    sessionId,
    text: text.trim(),
    // Each person chooses: a name, or blank to stay anonymous.
    name: plainText(form.get('name'), MAX_COMMENT_NAME),
    deviceId,
  });
  return backToComments(sessionId, 'posted', now);
}
