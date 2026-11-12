/**
 * A reaction tap during a talk. Called with fetch from the session page so
 * tapping never reloads it. Only while the talk is on, see reactionsOpen.
 */
import { getData } from '@/data';
import { getEventConfig } from '@/lib/config';
import { LIMITS, rateLimit } from '@/lib/rate-limit';
import { plainText } from '@/lib/text';
import { resolveEventNow } from '@/lib/time';
import { deviceIdOrNew } from '@/modules/backup/server';
import { isReactionKind, reactionsOpen } from '@/modules/talk/logic';
import { findSession } from '@/modules/talk/server';

export async function POST(request: Request): Promise<Response> {
  const config = getEventConfig();
  if (!config.features.reactions) return Response.json({ ok: false }, { status: 403 });

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const sessionId = plainText(body?.sessionId, 64);
  const kind = body?.kind;
  const session = findSession(sessionId);
  if (!session || !isReactionKind(kind)) return Response.json({ ok: false }, { status: 400 });

  const now = resolveEventNow({
    timezone: config.event.timezone,
    overrideParam: typeof body?.now === 'string' ? body.now : null,
  });
  if (!reactionsOpen(session, now)) {
    return Response.json({ ok: false, state: 'closed' }, { status: 409 });
  }

  const deviceId = await deviceIdOrNew();
  if (!rateLimit(`react:${deviceId}`, LIMITS.react).allowed) {
    return Response.json({ ok: false, state: 'slow-down' }, { status: 429 });
  }

  await getData().reactions.add({ sessionId, deviceId, kind });
  return Response.json({ ok: true });
}
