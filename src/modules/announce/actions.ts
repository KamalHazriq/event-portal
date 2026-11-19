'use server';

import { revalidatePath } from 'next/cache';

import { getData } from '@/data';
import { requireAdminApi } from '@/lib/admin-guard';
import { getEventConfig } from '@/lib/config';
import { newId } from '@/lib/ids';
import { recordActivity } from '@/modules/admins/record';

import {
  ANNOUNCE_KEYS,
  HISTORY_SIZE,
  cleanAnnouncementText,
  parseHistory,
  safeHref,
  type Announcement,
} from './logic';
import { pushToAll } from './push';

async function assertAdmin(): Promise<string> {
  const auth = await requireAdminApi();
  if (!auth.ok) throw new Error('Not signed in.');
  return auth.session.operator;
}

function done(): void {
  revalidatePath('/admin/announcements');
  // Every attendee page shows the banner.
  revalidatePath('/', 'layout');
}

/** Shows a message on every attendee page, and sends it to phones if asked. */
export async function postAnnouncement(formData: FormData): Promise<void> {
  const operator = await assertAdmin();
  const text = cleanAnnouncementText(String(formData.get('text') ?? ''));
  if (!text) return;
  const href = safeHref(String(formData.get('href') ?? ''));
  const send = formData.get('push') === 'on';

  let pushed: number | null = null;
  if (send) {
    const result = await pushToAll({
      title: getEventConfig().event.shortName,
      body: text,
      url: href || '/',
      tag: 'announcement',
    });
    pushed = result.sent;
  }

  const announcement: Announcement = {
    id: newId(),
    text,
    href,
    at: new Date().toISOString(),
    pushed,
  };
  const data = getData();
  const history = parseHistory(await data.settings.get(ANNOUNCE_KEYS.history));
  await data.settings.set(ANNOUNCE_KEYS.current, JSON.stringify(announcement));
  await data.settings.set(
    ANNOUNCE_KEYS.history,
    JSON.stringify([announcement, ...history].slice(0, HISTORY_SIZE)),
  );
  await recordActivity(
    `Posted an announcement${pushed === null ? '' : ` and sent it to ${pushed} phones`}: ${text}`,
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
