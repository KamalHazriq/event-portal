/**
 * Posting an announcement, shared by "Post now" on the Announce page and by
 * scheduled announcements when their time comes. Server only.
 *
 * Everyone: a banner at the top of every attendee page, and a notification to
 * the phones that turned alerts on (when asked). The secretariat team only:
 * a notification to the team phones, and no banner.
 */
import { getData } from '@/data';
import { getEventConfig } from '@/lib/config';
import { newId } from '@/lib/ids';
import { recordActivity } from '@/modules/admins/record';

import { ANNOUNCE_KEYS, HISTORY_SIZE, parseHistory, type Announcement } from './logic';
import { pushToAll, pushToTeam } from './push';

export async function publishAnnouncement(input: {
  text: string;
  href: string;
  teamOnly: boolean;
  /** Send a notification too. Always true for the team. */
  push: boolean;
  operator: string;
}): Promise<Announcement> {
  const { text, href, teamOnly, operator } = input;
  const send = teamOnly || input.push;
  const shortName = getEventConfig().event.shortName;

  let pushed: number | null = null;
  if (send) {
    const message = {
      title: teamOnly ? `Team: ${shortName}` : shortName,
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
  return announcement;
}
