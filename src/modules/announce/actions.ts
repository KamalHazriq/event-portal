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
  HISTORY_SIZE,
  NUDGE_KEYS,
  cleanAnnouncementText,
  parseHistory,
  safeHref,
  type Announcement,
} from './logic';
import { pushToAll, pushToDevice, pushToTeam } from './push';
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

/** Shows a message on every attendee page, and sends it to phones if asked. */
export async function postAnnouncement(formData: FormData): Promise<void> {
  const operator = await assertAdmin();
  const text = cleanAnnouncementText(String(formData.get('text') ?? ''));
  if (!text) return;
  const href = safeHref(String(formData.get('href') ?? ''));
  const teamOnly = formData.get('audience') === 'team';
  // A team message is only ever a notification, so it always goes out.
  const send = teamOnly || formData.get('push') === 'on';

  let pushed: number | null = null;
  if (send) {
    const message = {
      title: teamOnly
        ? `Team: ${getEventConfig().event.shortName}`
        : getEventConfig().event.shortName,
      body: text,
      url: href || (teamOnly ? '/admin' : '/'),
      tag: teamOnly ? 'team-message' : 'announcement',
    };
    pushed = (teamOnly ? await pushToTeam(message) : await pushToAll(message)).sent;
  }

  const announcement: Announcement = {
    id: newId(),
    text,
    href,
    at: new Date().toISOString(),
    pushed,
    ...(teamOnly ? { audience: 'team' as const } : {}),
    screen: formData.get('screen') === 'on',
  };
  const data = getData();
  const history = parseHistory(await data.settings.get(ANNOUNCE_KEYS.history));
  // Attendees only ever see the banner for a message meant for them.
  if (!teamOnly) await data.settings.set(ANNOUNCE_KEYS.current, JSON.stringify(announcement));
  await data.settings.set(
    ANNOUNCE_KEYS.history,
    JSON.stringify([announcement, ...history].slice(0, HISTORY_SIZE)),
  );
  await recordActivity(
    `${teamOnly ? 'Sent a team message' : 'Posted an announcement'}${pushed === null ? '' : ` to ${pushed} phones`}: ${text}`,
    operator,
  );
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
