/**
 * Undoes every check in on one day (or all days). For testing before the
 * event, so the counters start from zero again. Needs the PIN session and
 * the word UNDO typed in as a second check, so it cannot happen by a stray tap.
 */
import { z } from 'zod';

import { getData } from '@/data';
import { requireAdminApi } from '@/lib/admin-guard';
import { getEventConfig } from '@/lib/config';
import { recordActivity } from '@/modules/admins/record';

const BodySchema = z.object({
  dayId: z.string().min(1).max(64),
  confirm: z.string().max(20),
});

export async function POST(request: Request): Promise<Response> {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ ok: false, message: 'Could not read that request.' }, { status: 400 });
  }
  if (parsed.data.confirm.trim().toUpperCase() !== 'UNDO') {
    return Response.json({ ok: false, message: 'Type UNDO to confirm.' }, { status: 400 });
  }

  const { dayId } = parsed.data;
  const config = getEventConfig();
  if (dayId !== 'all' && !config.days.some((day) => day.id === dayId)) {
    return Response.json(
      { ok: false, message: 'That is not a day of this event.' },
      { status: 400 },
    );
  }

  const removed = await getData().checkIns.clear(dayId === 'all' ? undefined : dayId);
  await recordActivity(
    `Undid ALL check ins (${dayId === 'all' ? 'every day' : dayId}): ${removed} removed`,
    auth.session.operator,
  );
  return Response.json({ ok: true, removed, message: `${removed} check ins undone.` });
}
