'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { getData } from '@/data';
import { requireAdminApi } from '@/lib/admin-guard';
import { getEventConfig } from '@/lib/config';
import { DEVICE_COOKIE, readDeviceId } from '@/lib/device';
import { newId } from '@/lib/ids';
import { recordActivity } from '@/modules/admins/record';

import {
  ANNOUNCE_KEYS,
  NUDGE_KEYS,
  cleanAnnouncementText,
  safeHref,
} from './logic';
import { pushToDevice, pushToTeam } from './push';
import { publishAnnouncement } from './publish';
import { loadReminders, saveReminders } from '@/modules/reminders/dispatch';
import { isLocalDateTime, MAX_REMINDERS, type Reminder } from '@/modules/reminders/logic';
import { localDateTimeToInstant } from '@/lib/time';
import { TEAM_AUTO_KEY } from './team';

async function assertAdmin(): Promise<string> {
  const auth = await requireAdminApi();
  if (!auth.ok) throw new Error('Not signed in.');
  return auth.session.operator;
}

function done(): void {
  revalidatePath('/admin/announce');
  // Every attendee page shows the banner.
  revalidatePath('/', 'layout');
}

/**
 * Posts a message now, or schedules it for later ("when" is "later" with a
 * date and time). Shows on every attendee page and goes to phones if asked;
 * for the secretariat team only, it goes to the team phones and shows nowhere.
 */
export async function postAnnouncement(formData: FormData): Promise<void> {
  const operator = await assertAdmin();
  const text = cleanAnnouncementText(String(formData.get('text') ?? ''));
  if (!text) return;
  const href = safeHref(String(formData.get('href') ?? ''));
  const teamOnly = formData.get('audience') === 'team';

  if (formData.get('when') === 'later') {
    const at = String(formData.get('at') ?? '').trim();
    const ok =
      isLocalDateTime(at) && localDateTimeToInstant(at, getEventConfig().event.timezone) !== null;
    if (!ok) redirect('/admin/announce?schedule=bad#compose');
    const list = await loadReminders();
    if (list.length >= MAX_REMINDERS) redirect('/admin/announce?schedule=full#compose');
    const reminder: Reminder = {
      id: newId(),
      at,
      text,
      audience: teamOnly ? 'team' : 'everyone',
      ...(href ? { href } : {}),
      push: teamOnly || formData.get('push') === 'on',
    };
    await saveReminders([...list, reminder]);
    await recordActivity(`Scheduled for ${at.replace('T', ' ')}: ${text}`, operator);
    revalidatePath('/admin/announce');
    redirect('/admin/announce?schedule=saved#reminders');
  }

  await publishAnnouncement({
    text,
    href,
    teamOnly,
    push: formData.get('push') === 'on',
    operator,
  });
  done();
}

/** Sends a test to every secretariat phone with team alerts on. */
export async function sendTestToTeam(): Promise<void> {
  const operator = await assertAdmin();
  const result = await pushToTeam({
    title: `Team: ${getEventConfig().event.shortName}`,
    body: `Test from ${operator}. Team alerts work on this device.`,
    url: '/admin',
    tag: 'test-team',
  });
  redirect(`/admin/announce?test=${result.sent > 0 ? `team-sent-${result.sent}` : 'team-none'}`);
}

/** Switches "tell the team when photos or comments are waiting" on or off. */
export async function setTeamAuto(formData: FormData): Promise<void> {
  const operator = await assertAdmin();
  const on = formData.get('mode') === 'on';
  await getData().settings.set(TEAM_AUTO_KEY, on ? 'on' : 'off');
  await recordActivity(
    on ? 'Turned automatic team alerts on' : 'Turned automatic team alerts off',
    operator,
  );
  done();
}

export async function clearAnnouncement(): Promise<void> {
  const operator = await assertAdmin();
  await getData().settings.remove(ANNOUNCE_KEYS.current);
  await recordActivity('Took the announcement down', operator);
  done();
}

/** Turns the automatic 'How was the talk?' reminders on or off. */
export async function setFeedbackNudges(formData: FormData): Promise<void> {
  const operator = await assertAdmin();
  const on = formData.get('mode') === 'on';
  await getData().settings.set(NUDGE_KEYS.enabled, on ? 'on' : 'off');
  await recordActivity(
    on ? 'Turned automatic feedback reminders on' : 'Turned automatic feedback reminders off',
    operator,
  );
  done();
}

/** Sends a test alert to this device only, so nobody else is disturbed. */
export async function sendTestAlert(): Promise<void> {
  await assertAdmin();
  const deviceId = readDeviceId((await cookies()).get(DEVICE_COOKIE)?.value);
  const result = deviceId
    ? await pushToDevice(deviceId, {
        title: `${getEventConfig().event.shortName}: test alert`,
        body: 'Alerts work on this device.',
        url: '/',
        tag: 'test',
      })
    : { sent: 0, failed: 0, removed: 0 };
  redirect(
    `/admin/announce?test=${result.sent > 0 ? 'sent' : result.failed > 0 ? 'failed' : 'none'}`,
  );
}
