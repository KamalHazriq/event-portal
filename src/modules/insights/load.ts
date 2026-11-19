/** Reads everything the Insights page needs. Server only. */
import { getData } from '@/data';
import type { EventConfig } from '@/lib/event-schema';
import type { EventNow } from '@/lib/time';
import { moderationOn, PHOTO_KEYS } from '@/modules/photos/logic';

import type { InsightsInput } from './logic';

export async function loadInsightsInput(
  config: EventConfig,
  now: EventNow,
): Promise<InsightsInput> {
  const data = getData();
  const sessions = config.days.flatMap((d) => d.sessions);
  const [
    attendees,
    perDay,
    feedback,
    photos,
    reactions,
    commentLists,
    links,
    moderation,
    alertPhones,
  ] = await Promise.all([
    data.attendees.list(),
    Promise.all(config.days.map((day) => data.checkIns.listByDay(day.id))),
    data.feedback.listAll(),
    data.photos.list(),
    data.reactions.participation(),
    Promise.all(sessions.map((s) => data.comments.listBySession(s.id))),
    data.players.links(),
    data.settings.get(PHOTO_KEYS.moderation),
    data.push.count().catch(() => 0),
  ]);
  return {
    config,
    attendees,
    checkIns: perDay.flat().map(({ attendee: _attendee, ...checkIn }) => checkIn),
    feedback,
    photos,
    reactions,
    comments: commentLists.flat(),
    links,
    photosModerated: moderationOn(moderation),
    alertPhones,
    now,
  };
}
