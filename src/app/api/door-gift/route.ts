/**
 * Spins this phone's person for a door gift. The server decides; the phone
 * only plays the spin. Asking again returns the same gift.
 */
import { LIMITS, rateLimit } from '@/lib/rate-limit';
import { currentDeviceId } from '@/modules/backup/server';
import { claimDoorGift } from '@/modules/door-gift/server';
import { currentPlayer } from '@/modules/points/server';

export async function POST(): Promise<Response> {
  const device = await currentDeviceId();
  if (!device || !rateLimit(`gift:${device}`, LIMITS.join).allowed) {
    return Response.json({ message: 'Too many tries. Wait a moment.' }, { status: 429 });
  }
  const person = await currentPlayer();
  if (!person) return Response.json({ message: 'Say who you are first.' }, { status: 401 });
  const item = await claimDoorGift(person);
  if (!item) {
    return Response.json(
      { message: 'There is no door gift to spin for right now. Ask the registration desk.' },
      { status: 409 },
    );
  }
  return Response.json({ item: { id: item.id, name: item.name, image: item.image } });
}
