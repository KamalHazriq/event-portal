'use server';

import { redirect } from 'next/navigation';

import { getData } from '@/data';
import { getEventConfig } from '@/lib/config';
import { plainText } from '@/lib/text';
import { LIMITS, rateLimit } from '@/lib/rate-limit';
import { currentDeviceId, deviceIdOrNew } from '@/modules/backup/server';
import { nameTokens } from '@/modules/check-in/business-card';

/**
 * Signs this phone in as a person, for points.
 *
 * It asks for the staff number and a name, and both have to agree. So
 * typing in staff numbers does not reveal whose they are, and nobody signs
 * in as a colleague by accident. It is not a password: the stakes are a
 * leaderboard, and the secretariat can see and undo any link.
 */
export async function joinLeaderboard(formData: FormData): Promise<void> {
  const config = getEventConfig();
  if (!config.features.leaderboard) redirect('/');

  const deviceId = await deviceIdOrNew();
  if (!rateLimit(`join:${deviceId}`, LIMITS.join).allowed) redirect('/me?state=too-many');

  const staffNo = plainText(String(formData.get('staffNo') ?? ''), 40).replace(/\s+/g, '');
  const typed = nameTokens(plainText(String(formData.get('name') ?? ''), 120));
  if (!staffNo || typed.length === 0) redirect('/me?state=missing');

  const data = getData();
  const person = await data.attendees.findByStaffNo(staffNo);
  const theirs = new Set(person ? nameTokens(person.name) : []);
  // Every word typed has to be part of their name: "Aiman", or "Aiman Rafi".
  if (!person || !typed.every((word) => theirs.has(word))) redirect('/me?state=no-match');

  await data.players.link(deviceId, person.id);
  redirect('/me?state=joined');
}

export async function leaveLeaderboard(): Promise<void> {
  const deviceId = await currentDeviceId();
  if (deviceId) await getData().players.unlink(deviceId);
  redirect('/me?state=left');
}
