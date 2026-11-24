/**
 * The door gift spin at the registration desk (or the kiosk), for the person
 * just checked in. The server decides; the screen only plays the spin.
 * Asking again returns the same gift. Secretariat only.
 */
import { getData } from '@/data';
import { requireAdminApi } from '@/lib/admin-guard';
import { plainText } from '@/lib/text';
import { recordActivity } from '@/modules/admins/record';
import { newId } from '@/lib/ids';
import { GUEST_PREFIX } from '@/modules/door-gift/logic';
import { claimDoorGift, giftView, markCollected } from '@/modules/door-gift/server';

export async function POST(request: Request): Promise<Response> {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  // Someone not on the list: a spin of their own, under a new guest id.
  if (body?.guest === true) {
    const id = `${GUEST_PREFIX}${newId()}`;
    const guestName = plainText(body.guestName, 80);
    const item = await claimDoorGift({ id, isSecretariat: false }, guestName);
    if (!item) {
      return Response.json(
        { message: 'No door gift to spin for right now. Check the Door gifts page.' },
        { status: 409 },
      );
    }
    await recordActivity(`Door gift spin for a guest: ${item.name}`, auth.session.operator);
    return Response.json({ claimId: id, item: giftView(item) });
  }

  const attendeeId = plainText(body?.attendeeId, 64);
  // A guest's gift handed over.
  if (attendeeId.startsWith(GUEST_PREFIX) && body?.action === 'collected') {
    await markCollected({ id: attendeeId });
    return Response.json({ ok: true });
  }
  const person = attendeeId ? await getData().attendees.get(attendeeId) : null;
  if (!person)
    return Response.json({ message: 'That person is not on the list.' }, { status: 404 });

  if (body?.action === 'collected') {
    await markCollected(person);
    return Response.json({ ok: true });
  }

  const item = await claimDoorGift(person);
  if (!item) {
    return Response.json(
      { message: 'No door gift to spin for right now. Check the Door gifts page.' },
      { status: 409 },
    );
  }
  await recordActivity(`Door gift spin: ${item.name}`, auth.session.operator);
  return Response.json({ item: giftView(item) });
}
