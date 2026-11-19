/**
 * Sends the automatic feedback reminders. Server only.
 *
 * There is no scheduler on the hosting, so this runs after the big screen
 * or the live control page has answered (both refresh every few seconds on
 * the event days). Each talk is marked as reminded before sending, so two
 * server copies rarely both send; if they do, the phone shows one, because
 * both use the same notification tag.
 */
import { getData } from '@/data';
import { getEventConfig } from '@/lib/config';
import { toMinutes, type EventNow } from '@/lib/time';
import { readFormSettings } from '@/modules/feedback/settings';

import { dueFeedbackNudges, NUDGE_KEYS } from './logic';
import { pushToAll } from './push';

export async function runFeedbackNudges(now: EventNow): Promise<number> {
  if (now.isOverride) return 0; // Never from a test clock.
  const config = getEventConfig();
  if (!config.features.feedback) return 0;
  const data = getData();
  if ((await data.settings.get(NUDGE_KEYS.enabled)) !== 'on') return 0;

  const sent = new Map<string, boolean>();
  const days = config.days;
  for (const s of days.find((d) => d.date === now.date)?.sessions ?? []) {
    sent.set(s.id, (await data.settings.get(NUDGE_KEYS.sentFor(s.id))) !== null);
  }
  const due = dueFeedbackNudges(days, now, (id) => sent.get(id) ?? false, toMinutes);

  let count = 0;
  for (const session of due) {
    if (!(await readFormSettings(session.id)).open) continue;
    await data.settings.set(NUDGE_KEYS.sentFor(session.id), new Date().toISOString());
    await pushToAll({
      title: `How was "${session.title}"?`,
      body: 'Rate it in under a minute. It helps the next summit.',
      url: `/feedback/${session.id}`,
      tag: `feedback-${session.id}`,
    }).catch(() => undefined);
    count++;
  }
  return count;
}
