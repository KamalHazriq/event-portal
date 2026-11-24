/**
 * The alert log: every notification that was sent, and to whom. Kept in the
 * settings table, newest first, the last sixty. Server only.
 */
import { getData } from '@/data';
import type { PushSubscriptionRecord } from '@/data/types';

export const ALERT_LOG_KEY = 'alerts.log';
export const ALERT_LOG_SIZE = 60;

export type AlertEntry = {
  at: string;
  title: string;
  body: string;
  /** What kind: announcement, team-message, team-photo, lucky-draw, test... */
  tag: string;
  sent: number;
  failed: number;
  /** The names of the people whose phones it went to. */
  names: string[];
  /** Phones that are not signed in as anyone, so no name to give. */
  unnamed: number;
};

export function parseAlertLog(raw: string | null): AlertEntry[] {
  if (!raw) return [];
  try {
    const v: unknown = JSON.parse(raw);
    return Array.isArray(v)
      ? v.filter((e): e is AlertEntry => typeof e?.title === 'string' && Array.isArray(e?.names))
      : [];
  } catch {
    return [];
  }
}

/** Notes one send. Never throws: the log is a convenience, the alert already went. */
export async function logAlert(
  subs: PushSubscriptionRecord[],
  message: { title: string; body: string; tag?: string },
  result: { sent: number; failed: number },
): Promise<void> {
  try {
    const data = getData();
    const [links, people, raw] = await Promise.all([
      data.players.links(),
      data.attendees.list(),
      data.settings.get(ALERT_LOG_KEY),
    ]);
    const owner = new Map(links.map((l) => [l.deviceId, l.attendeeId]));
    const nameOf = new Map(people.map((p) => [p.id, p.name]));
    const names = new Set<string>();
    let unnamed = 0;
    for (const sub of subs) {
      const who = sub.deviceId ? nameOf.get(owner.get(sub.deviceId) ?? '') : undefined;
      if (who) names.add(who);
      else unnamed += 1;
    }
    const entry: AlertEntry = {
      at: new Date().toISOString(),
      title: message.title,
      body: message.body.slice(0, 200),
      tag: message.tag ?? '',
      sent: result.sent,
      failed: result.failed,
      names: [...names].sort((a, b) => a.localeCompare(b)),
      unnamed,
    };
    await data.settings.set(
      ALERT_LOG_KEY,
      JSON.stringify([entry, ...parseAlertLog(raw)].slice(0, ALERT_LOG_SIZE)),
    );
  } catch {
    // Nothing to do.
  }
}
