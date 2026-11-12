/** Someone likes a comment. One like per phone per comment. */
import { getData } from '@/data';
import { getEventConfig } from '@/lib/config';
import { LIMITS, rateLimit } from '@/lib/rate-limit';
import { plainText } from '@/lib/text';
import { deviceIdOrNew } from '@/modules/backup/server';
import { backToComments, findSession } from '@/modules/talk/server';

export async function POST(request: Request): Promise<Response> {
  const config = getEventConfig();
  const form = await request.formData().catch(() => null);
  const sessionId = plainText(form?.get('sessionId'), 64);
  const commentId = plainText(form?.get('commentId'), 64);
  const now = plainText(form?.get('now'), 20) || null;

  if (!form || !config.features.comments || !findSession(sessionId)) {
    return Response.json({ ok: false, state: 'closed' }, { status: 403 });
  }

  const deviceId = await deviceIdOrNew();
  if (!rateLimit(`comment-like:${deviceId}`, LIMITS.commentLike).allowed) {
    return backToComments(sessionId, 'slow-down', now);
  }

  const data = getData();
  // Only a comment the room can see can be liked, so a like can never
  // reveal that a waiting or hidden comment exists.
  const comment = (await data.comments.listBySession(sessionId)).find((c) => c.id === commentId);
  if (!comment || comment.status !== 'approved') return backToComments(sessionId, 'gone', now);

  const counted = await data.comments.like(commentId, deviceId);
  return backToComments(sessionId, counted ? 'liked' : 'already', now);
}
