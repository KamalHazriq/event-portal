/**
 * Undoes a check in, for when the wrong tag was scanned.
 */
import { z } from 'zod';

import { getData } from '@/data';
import { requireAdminApi } from '@/lib/admin-guard';
import { getEventConfig } from '@/lib/config';
import { LIMITS, rateLimit } from '@/lib/rate-limit';
import { arrivalRate } from '@/modules/check-in/logic';

const BodySchema = z.object({
  attendeeId: z.string().min(1).max(64),
  dayId: z.string().min(1).max(64),
});

export async function POST(request: Request): Promise<Response> {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const limit = rateLimit(`undo:${auth.session.operator}`, LIMITS.checkIn);
  if (!limit.allowed) {
    return Response.json(
      { ok: false, message: 'Too many changes, wait a moment.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, message: 'Could not read that request.' }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ ok: false, message: 'Could not read that request.' }, { status: 400 });
  }

  const { attendeeId, dayId } = parsed.data;

  const config = getEventConfig();
  if (!config.days.some((day) => day.id === dayId)) {
    return Response.json(
      { ok: false, message: 'That is not a day of this event.' },
      { status: 400 },
    );
  }

  const data = getData();
  const removed = await data.checkIns.remove(attendeeId, dayId);
  const headcount = await data.checkIns.headcount(dayId);

  return Response.json({
    ok: true,
    removed,
    message: removed ? 'Check in undone.' : 'That person was not checked in.',
    headcount: arrivalRate(headcount.arrived, headcount.expected),
  });
}
