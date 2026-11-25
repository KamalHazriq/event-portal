/**
 * Likes and comments on a photo on the wall. A like needs no name; a comment
 * carries the name this phone signed in with, like every other comment.
 */
import { getData } from '@/data';
import { getEventConfig } from '@/lib/config';
import { LIMITS, rateLimit } from '@/lib/rate-limit';
import { multilineText, plainText } from '@/lib/text';
import { deviceIdOrNew } from '@/modules/backup/server';
import { likePhoto, photoSessionId } from '@/modules/photos/social';
import {
  COMMENT_KEYS,
  commentsNeedApproval,
  MAX_COMMENT,
  MAX_COMMENT_NAME,
  validateComment,
} from '@/modules/talk/logic';

function back(photoId: string, state: string): Response {
  return new Response(null, {
    status: 303,
    headers: {
      Location: `/photos?state=${encodeURIComponent(state)}&open=${encodeURIComponent(photoId)}#photo-${photoId}`,
    },
  });
}

export async function POST(request: Request): Promise<Response> {
  const config = getEventConfig();
  const form = await request.formData().catch(() => null);
  const photoId = plainText(form?.get('photoId'), 64);
  if (!form || !config.features.photoWall || !photoId) {
    return Response.json({ ok: false, state: 'closed' }, { status: 403 });
  }

  const data = getData();
  // Only a photo that is on the wall.
  const photo = (await data.photos.list('approved')).find((p) => p.id === photoId);
  if (!photo) return Response.json({ ok: false, state: 'gone' }, { status: 404 });

  const deviceId = await deviceIdOrNew();
  const wantsJson = (request.headers.get('accept') ?? '').includes('application/json');
  const action = plainText(form.get('action'), 12);

  if (action === 'like') {
    if (!rateLimit(`photo-like:${deviceId}`, LIMITS.commentLike).allowed) {
      return wantsJson ? Response.json({ ok: false }, { status: 429 }) : back(photoId, 'slow-down');
    }
    const result = await likePhoto(photoId, deviceId);
    return wantsJson ? Response.json({ ok: true, ...result }) : back(photoId, 'liked');
  }

  if (action === 'comment') {
    if (!config.features.comments) return back(photoId, 'closed');
    if (!rateLimit(`photo-comment:${deviceId}`, LIMITS.comment).allowed) {
      return back(photoId, 'slow-down');
    }
    const ownerId = await data.players.ownerOf(deviceId);
    const owner = ownerId ? await data.attendees.get(ownerId) : null;
    if (!owner) return back(photoId, 'who');
    const text = multilineText(form.get('text'), MAX_COMMENT + 1).replace(/\s*\n\s*/g, ' ');
    const sessionId = photoSessionId(photoId);
    const checked = validateComment({
      text,
      alreadyPosted: await data.comments.countByDevice(sessionId, deviceId),
    });
    if (!checked.ok) return back(photoId, checked.problem);
    const waits = commentsNeedApproval(await data.settings.get(COMMENT_KEYS.approval));
    await data.comments.add({
      sessionId,
      text: text.trim(),
      status: waits ? 'pending' : 'approved',
      name: owner.name.slice(0, MAX_COMMENT_NAME),
      deviceId,
    });
    return back(photoId, waits ? 'posted' : 'live');
  }

  return Response.json({ ok: false }, { status: 400 });
}
