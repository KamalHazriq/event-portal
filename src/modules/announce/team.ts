/**
 * Alerts for the secretariat team, never for attendees. Server only.
 *
 * "Something is waiting for approval" goes to the phones that turned on team
 * alerts, so a moderator does not have to keep refreshing a page. At most one
 * per kind every few minutes, so a burst of photos is one buzz, not twenty.
 * On by default; a switch on the Announce page turns it off.
 */
import { getData } from '@/data';

import { pushToTeam } from './push';

export const TEAM_AUTO_KEY = 'team.autoAlerts';
/** The gap between two alerts of the same kind. */
export const TEAM_ALERT_GAP_MS = 5 * 60 * 1000;

export function teamAutoOn(stored: string | null): boolean {
  return stored !== 'off';
}

/** Whether an alert is due: nothing sent yet, or the last one was long enough ago. */
export function alertDue(lastSentAt: number | undefined, now: number): boolean {
  return lastSentAt === undefined || now - lastSentAt >= TEAM_ALERT_GAP_MS;
}

const lastSent = new Map<string, number>();

const WAITING = {
  photo: {
    title: 'Photo waiting',
    body: 'A shared photo is waiting for approval.',
    url: '/admin/photos',
  },
  comment: {
    title: 'Comment waiting',
    body: 'A comment is waiting for approval.',
    url: '/admin/comments',
  },
} as const;

export async function notifyTeamWaiting(kind: keyof typeof WAITING): Promise<void> {
  if (!teamAutoOn(await getData().settings.get(TEAM_AUTO_KEY))) return;
  const now = Date.now();
  if (!alertDue(lastSent.get(kind), now)) return;
  lastSent.set(kind, now);
  await pushToTeam({ ...WAITING[kind], tag: `team-${kind}` });
}
