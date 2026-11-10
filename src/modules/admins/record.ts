/**
 * Writing to the secretariat's log. Server only.
 *
 * It may never break the thing the desk was actually doing, so it swallows
 * its own failures. And it holds no personal data: the action
 * text is written here in code, never taken from what someone typed, and
 * never names an attendee.
 */
import { getData } from '@/data';
import { getAdminSession } from '@/lib/admin-guard';

/** Adds a line to the log for whichever desk is signed in. */
export async function recordActivity(action: string, operator?: string): Promise<void> {
  try {
    const who = operator ?? (await getAdminSession())?.operator;
    if (who) await getData().activity.log(who, action);
  } catch {
    // The log is a convenience. Losing a line is better than failing a check in.
  }
}
