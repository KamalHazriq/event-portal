/**
 * Phone notifications (web push). Server only.
 *
 * The signing keys (VAPID) are made on first use and kept in the settings
 * table, so there is nothing to set up. If VAPID_PUBLIC_KEY and
 * VAPID_PRIVATE_KEY are set in the environment, those are used instead.
 * A phone that has gone away (the push service answers 404 or 410) is
 * forgotten.
 */
import webpush from 'web-push';

import { getData } from '@/data';
import type { PushSubscriptionRecord } from '@/data/types';
import { getEventConfig } from '@/lib/config';

import { isPushServiceUrl } from './logic';

const KEYS_SETTING = 'push.vapid';

export type PushMessage = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  icon?: string;
};

type Keys = { publicKey: string; privateKey: string };

let cached: Keys | null = null;

export async function vapidKeys(): Promise<Keys> {
  if (cached) return cached;
  const fromEnv = {
    publicKey: process.env.VAPID_PUBLIC_KEY ?? '',
    privateKey: process.env.VAPID_PRIVATE_KEY ?? '',
  };
  if (fromEnv.publicKey && fromEnv.privateKey) return (cached = fromEnv);

  const settings = getData().settings;
  const stored = await settings.get(KEYS_SETTING);
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as Keys;
      if (parsed.publicKey && parsed.privateKey) return (cached = parsed);
    } catch {
      // Unreadable: make new ones below. Phones re-subscribe on their next visit.
    }
  }
  const made = webpush.generateVAPIDKeys();
  await settings.set(KEYS_SETTING, JSON.stringify(made));
  return (cached = made);
}

/** The push services ask for a contact: the portal's own address will do. */
function subject(): string {
  const url = getEventConfig().event.portalUrl;
  return /^https:\/\//.test(url) ? url : 'https://portal.invalid';
}

export type SendResult = { sent: number; failed: number; removed: number };

async function sendTo(all: PushSubscriptionRecord[], message: PushMessage): Promise<SendResult> {
  // Belt and braces: only ever send to a browser push service.
  const subs = all.filter((s) => isPushServiceUrl(s.endpoint));
  if (subs.length === 0) return { sent: 0, failed: 0, removed: 0 };
  const keys = await vapidKeys();
  const payload = JSON.stringify({ icon: getEventConfig().branding.iconPath, ...message });
  const data = getData();
  const result: SendResult = { sent: 0, failed: 0, removed: 0 };

  // A few at a time, so a hundred phones do not open a hundred connections.
  for (let i = 0; i < subs.length; i += 20) {
    await Promise.all(
      subs.slice(i, i + 20).map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload,
            {
              vapidDetails: { subject: subject(), ...keys },
              TTL: 60 * 60,
              timeout: 8000,
              urgency: 'high',
            },
          );
          result.sent++;
        } catch (error) {
          const status = (error as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) {
            await data.push.remove(sub.endpoint).catch(() => false);
            result.removed++;
          } else {
            result.failed++;
          }
        }
      }),
    );
  }
  return result;
}

export async function pushToAll(message: PushMessage): Promise<SendResult> {
  return sendTo(await getData().push.list(), message);
}

/** Only the phones linked (for points) to these people. */
export async function pushToPeople(
  attendeeIds: string[],
  message: PushMessage,
): Promise<SendResult> {
  if (attendeeIds.length === 0) return { sent: 0, failed: 0, removed: 0 };
  const data = getData();
  const wanted = new Set(attendeeIds);
  const devices = new Set(
    (await data.players.links()).filter((l) => wanted.has(l.attendeeId)).map((l) => l.deviceId),
  );
  const subs = (await data.push.list()).filter((s) => s.deviceId && devices.has(s.deviceId));
  return sendTo(subs, message);
}

/** Only this phone (by its device id), for a test from the Announce page. */
export async function pushToDevice(deviceId: string, message: PushMessage): Promise<SendResult> {
  const subs = (await getData().push.list()).filter((s) => s.deviceId === deviceId);
  return sendTo(subs, message);
}
