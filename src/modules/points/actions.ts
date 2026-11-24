'use server';

import { redirect } from 'next/navigation';

import { getData } from '@/data';
import { getEventConfig } from '@/lib/config';
import { plainText } from '@/lib/text';
import { LIMITS, rateLimit } from '@/lib/rate-limit';
import { currentDeviceId, deviceIdOrNew } from '@/modules/backup/server';
import { safeNext } from '@/modules/identity/logic';

/**
 * Signs this device in as a person, for points.
 *
 * The staff number alone is enough: it is on the person's record, and it
 * is the same proof that is asked for when a name is already taken. It is
 * not a password: the stakes are a leaderboard, and the secretariat can see
 * and undo any link.
 */
export async function joinLeaderboard(formData: FormData): Promise<void> {
  const config = getEventConfig();
  if (!config.features.leaderboard) redirect('/');

  const deviceId = await deviceIdOrNew();
  if (!rateLimit(`join:${deviceId}`, LIMITS.join).allowed) redirect('/me?state=too-many');

  const staffNo = plainText(String(formData.get('staffNo') ?? ''), 40).replace(/\s+/g, '');
  if (!staffNo) redirect('/me?state=missing');

  const data = getData();
  const person = await data.attendees.findByStaffNo(staffNo);
  if (!person) redirect('/me?state=no-match');

  await data.players.link(deviceId, person.id);
  redirect('/me?state=joined');
}

/**
 * Signs this device in by picking a name from the list, so no staff number
 * needs typing: the person's record already has it. If someone has already
 * joined as that person on another phone (or this device's memory was
 * cleared), the staff number is asked for as proof, so nobody can take
 * over a colleague's name just by tapping it.
 */
export async function joinAsPerson(formData: FormData): Promise<void> {
  const config = getEventConfig();
  if (!config.features.leaderboard) redirect('/');

  // From the Welcome page the answers go back there, and on to the page
  // the phone was opening (or the door gift spin) once it is done.
  const fromWelcome = formData.get('from') === 'welcome';
  const next = safeNext(formData.get('next'));
  const home = fromWelcome ? '/welcome' : '/me';
  const keep = fromWelcome ? `&next=${encodeURIComponent(next)}` : '';

  const deviceId = await deviceIdOrNew();
  if (!rateLimit(`join:${deviceId}`, LIMITS.join).allowed)
    redirect(`${home}?state=too-many${keep}`);

  const attendeeId = plainText(String(formData.get('attendeeId') ?? ''), 64);
  const typed = plainText(String(formData.get('staffNo') ?? ''), 40).replace(/\s+/g, '');

  const data = getData();
  const person = attendeeId ? await data.attendees.get(attendeeId) : null;
  if (!person) redirect(`${home}?state=missing${keep}`);

  const takenElsewhere = (await data.players.links()).some(
    (link) => link.attendeeId === person.id && link.deviceId !== deviceId,
  );
  if (takenElsewhere) {
    const who = `state=taken&who=${encodeURIComponent(person.id)}`;
    if (!typed) redirect(`${home}?${who}${keep}`);
    if (typed.toLowerCase() !== person.staffNo.replace(/\s+/g, '').toLowerCase()) {
      redirect(`${home}?${who}&wrong=1${keep}`);
    }
  }

  await data.players.link(deviceId, person.id);
  if (!fromWelcome) redirect('/me?state=joined');

  redirect(next);
}

export async function leaveLeaderboard(): Promise<void> {
  const deviceId = await currentDeviceId();
  if (deviceId) await getData().players.unlink(deviceId);
  redirect('/me?state=left');
}
