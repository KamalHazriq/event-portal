/**
 * Records an arrival.
 *
 * A route handler rather than a Server Action on purpose. The Next.js docs
 * say the client dispatches Server Actions one at a time and each one
 * re-renders the page, which is the wrong shape for a desk scanning a queue
 * of 80 people. This answers with a small JSON payload instead, so the next
 * scan can start immediately.
 */
import { z } from 'zod';

import { requireAdminApi } from '@/lib/admin-guard';
import { getData } from '@/data';
import { LIMITS, rateLimit } from '@/lib/rate-limit';
import { arrivalRate, parseScanPayload, scanOutcomeMessage } from '@/modules/check-in/logic';
import type { ScanOutcome } from '@/modules/check-in/logic';
import { getEventConfig } from '@/lib/config';
import { recordActivity } from '@/modules/admins/record';

const BodySchema = z.object({
  /** What the scanner read, or what was typed. Either a URL or a token. */
  payload: z.string().max(400).optional(),
  /** Used by the manual search path, where the person was already found. */
  attendeeId: z.string().max(64).optional(),
  dayId: z.string().min(1).max(64),
  method: z.enum(['qr', 'manual', 'admin']).default('qr'),
});

function reply(outcome: ScanOutcome, extra: Record<string, unknown> = {}, status = 200): Response {
  return Response.json({ outcome, message: scanOutcomeMessage(outcome), ...extra }, { status });
}

export async function POST(request: Request): Promise<Response> {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const operator = auth.session.operator;

  const limit = rateLimit(`checkin:${operator}`, LIMITS.checkIn);
  if (!limit.allowed) {
    return Response.json(
      { outcome: 'rate-limited', message: scanOutcomeMessage('rate-limited') },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return reply('unreadable', {}, 400);
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return reply('unreadable', {}, 400);

  const { payload, attendeeId, dayId, method } = parsed.data;

  // The day has to be one the event actually has, not whatever was posted.
  const config = getEventConfig();
  if (!config.days.some((day) => day.id === dayId)) {
    return reply('error', { message: 'That is not a day of this event.' }, 400);
  }

  const data = getData();

  try {
    const attendee = attendeeId
      ? await data.attendees.get(attendeeId)
      : await (async () => {
          const token = payload ? parseScanPayload(payload) : null;
          if (!token) return null;
          return data.attendees.findByCheckInToken(token);
        })();

    if (!attendee) {
      // Tell apart "that was not a code at all" from "not on the list", so
      // the desk knows whether to rescan or to look the person up by name.
      const unreadable = !attendeeId && (!payload || parseScanPayload(payload) === null);
      return reply(unreadable ? 'unreadable' : 'not-found', {}, 404);
    }

    const { checkIn, alreadyCheckedIn } = await data.checkIns.create({
      attendeeId: attendee.id,
      dayId,
      method,
      byOperator: operator,
    });

    const headcount = await data.checkIns.headcount(dayId);

    if (!alreadyCheckedIn) {
      await recordActivity(
        method === 'qr' ? 'Checked in a guest by QR' : 'Checked in a guest by name search',
        operator,
      );
    }
    return reply(alreadyCheckedIn ? 'already-checked-in' : 'checked-in', {
      // Only what the desk screen shows. Never the check in token.
      attendee: {
        id: attendee.id,
        name: attendee.name,
        title: attendee.title,
        department: attendee.department,
        remark: attendee.remark,
        isSecretariat: attendee.isSecretariat,
      },
      checkedInAt: checkIn.at,
      headcount: arrivalRate(headcount.arrived, headcount.expected),
    });
  } catch (error) {
    // No attendee details in the log: the brief says no personal data in logs.
    console.error('check-in failed', error instanceof Error ? error.message : 'unknown error');
    return reply('error', {}, 500);
  }
}
