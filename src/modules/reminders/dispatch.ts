/**
 * Sends the reminders whose time has come. Server only.
 *
 * Called by Cloud Scheduler (POST /api/cron/reminders, every minute) and,
 * as a back-up, whenever the big screen or the live page is open. A reminder
 * is marked sent before it goes out, so two callers at once cannot both send it.
 */
import { getData } from '@/data';
import { getEventConfig } from '@/lib/config';
import { localDateTimeToInstant } from '@/lib/time';
import { publishAnnouncement } from '@/modules/announce/publish';

import {
  dueReminders,
  parseReminders,
  REMINDERS_KEY,
  REMINDERS_PING_KEY,
  type Reminder,
} from './logic';

export async function loadReminders(): Promise<Reminder[]> {
  return parseReminders(await getData().settings.get(REMINDERS_KEY));
}

export async function saveReminders(list: Reminder[]): Promise<void> {
  await getData().settings.set(REMINDERS_KEY, JSON.stringify(list));
}

let running = false;

export async function dispatchDueReminders(now: Date = new Date()): Promise<number> {
  if (running) return 0;
  running = true;
  try {
    const settings = getData().settings;
    await settings.set(REMINDERS_PING_KEY, now.toISOString());
    const timezone = getEventConfig().event.timezone;
    const list = await loadReminders();
    const due = dueReminders(list, now, (local) => localDateTimeToInstant(local, timezone));
    if (due.length === 0) return 0;

    // Mark first, then send.
    const ids = new Set(due.map((r) => r.id));
    await saveReminders(list.map((r) => (ids.has(r.id) ? { ...r, sentAt: now.toISOString() } : r)));
    // Posted just like one sent by hand: a banner for everyone, a notification.
    for (const r of due) {
      await publishAnnouncement({
        text: r.text,
        href: r.href ?? '',
        teamOnly: r.audience === 'team',
        push: r.push ?? true,
        minutes: r.minutes,
        operator: 'scheduled',
      }).catch(() => null);
    }
    return due.length;
  } finally {
    running = false;
  }
}
