'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { getData } from '@/data';
import { requireAdminApi } from '@/lib/admin-guard';
import { getEventConfig } from '@/lib/config';
import { recordActivity } from '@/modules/admins/record';
import { BONUS_KEY, EARLY_KEY, parseBonus, parseBonusPoints } from './logic';
import { plainText } from '@/lib/text';
import { LIMITS, rateLimit } from '@/lib/rate-limit';
import {
  currentDeviceId,
  deviceIdFor,
  deviceIdOrNew,
  startFreshDevice,
} from '@/modules/backup/server';
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

  await data.players.link(await deviceIdFor(person.id), person.id);
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

  await data.players.link(await deviceIdFor(person.id), person.id);
  if (!fromWelcome) redirect('/me?state=joined');

  redirect(next);
}

export async function leaveLeaderboard(): Promise<void> {
  const deviceId = await currentDeviceId();
  if (deviceId) await getData().players.unlink(deviceId);
  // Whoever signs in next on this phone starts from nothing.
  await startFreshDevice();
  redirect('/me?state=left');
}

/* ------------------------------------------------------------------- bonus */

async function assertAdmin(): Promise<string> {
  const auth = await requireAdminApi();
  if (!auth.ok) throw new Error('Not signed in.');
  return auth.session.operator;
}

/**
 * Gives a person extra points by hand, for taking part beyond the portal
 * (helping, a great question on stage). The person is picked by the list in
 * the form, "Name (STAFFNO)"; a bare staff number works too.
 */
export async function addBonus(formData: FormData): Promise<void> {
  const operator = await assertAdmin();
  const data = getData();
  const typed = plainText(String(formData.get('person') ?? ''), 160);
  const staffNo = (/\(([^()]+)\)\s*$/.exec(typed)?.[1] ?? typed).replace(/\s+/g, '');
  const person = staffNo ? await data.attendees.findByStaffNo(staffNo) : null;
  const points = parseBonusPoints(formData.get('points'));
  if (!person) redirect('/admin/points?bonus=person#bonus');
  if (points === null) redirect('/admin/points?bonus=points#bonus');

  const entries = parseBonus(await data.settings.get(BONUS_KEY));
  entries.push({
    id: `b${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    attendeeId: person.id,
    points,
    reason: plainText(String(formData.get('reason') ?? ''), 120),
    by: operator,
    at: new Date().toISOString(),
  });
  await data.settings.set(BONUS_KEY, JSON.stringify(entries));
  await recordActivity(`Gave ${points} bonus points to ${person.name}`, operator);
  revalidatePath('/', 'layout');
  redirect(`/admin/points?bonus=added&who=${encodeURIComponent(person.name)}#bonus`);
}

/** Takes one bonus back. */
export async function removeBonus(formData: FormData): Promise<void> {
  const operator = await assertAdmin();
  const data = getData();
  const id = String(formData.get('id') ?? '');
  const entries = parseBonus(await data.settings.get(BONUS_KEY));
  const gone = entries.find((e) => e.id === id);
  await data.settings.set(BONUS_KEY, JSON.stringify(entries.filter((e) => e.id !== id)));
  if (gone) await recordActivity(`Took back ${gone.points} bonus points`, operator);
  revalidatePath('/', 'layout');
  redirect('/admin/points?bonus=removed#bonus');
}

/** Saves, for each day, the time before which a scan counts as early. */
export async function saveEarlyCutoffs(formData: FormData): Promise<void> {
  const operator = await assertAdmin();
  const config = getEventConfig();
  const cutoffs: Record<string, string> = {};
  for (const day of config.days) {
    const value = String(formData.get(`early-${day.id}`) ?? '');
    if (/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) cutoffs[day.id] = value;
  }
  await getData().settings.set(EARLY_KEY, JSON.stringify(cutoffs));
  await recordActivity('Changed the early arrival times', operator);
  revalidatePath('/', 'layout');
  redirect('/admin/points?early=saved#attendance');
}
