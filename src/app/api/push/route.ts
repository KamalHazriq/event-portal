/**
 * Event alerts on a phone (web push).
 *   GET     the public key the browser needs to subscribe
 *   POST    { endpoint, keys: { p256dh, auth } } turns alerts on
 *   DELETE  { endpoint } turns them off
 * Nothing personal is stored: the push address, its keys and the phone's
 * random device id.
 */
import { cookies } from 'next/headers';
import { z } from 'zod';

import { getData } from '@/data';
import { getAdminSession } from '@/lib/admin-guard';
import { DEVICE_COOKIE, deviceCookieOptions, newDeviceId, readDeviceId } from '@/lib/device';
import { LIMITS, rateLimit } from '@/lib/rate-limit';
import { isPushServiceUrl } from '@/modules/announce/logic';
import { vapidKeys } from '@/modules/announce/push';

const Subscription = z.object({
  team: z.boolean().optional(),
  endpoint: z.string().url().max(1000).refine(isPushServiceUrl, 'not a browser push service'),
  keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(4).max(100) }),
});

const Endpoint = z.object({ endpoint: z.string().max(1000), team: z.boolean().optional() });

function caller(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'local'
  );
}

export async function GET(request: Request): Promise<Response> {
  const { publicKey } = await vapidKeys();
  // With ?endpoint=, also say whether that phone is signed up, and for team alerts.
  const endpoint = new URL(request.url).searchParams.get('endpoint');
  const known = endpoint && isPushServiceUrl(endpoint) ? await getData().push.get(endpoint) : null;
  return Response.json(
    { publicKey, on: known !== null, team: known?.team ?? false },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function POST(request: Request): Promise<Response> {
  if (!rateLimit(`push:${caller(request)}`, LIMITS.push).allowed) {
    return Response.json({ ok: false }, { status: 429 });
  }
  const parsed = Subscription.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false }, { status: 400 });

  const store = await cookies();
  let deviceId = readDeviceId(store.get(DEVICE_COOKIE)?.value);
  if (!deviceId) {
    deviceId = newDeviceId();
    store.set(DEVICE_COOKIE, deviceId, deviceCookieOptions);
  }
  // Team alerts are for the secretariat: only a signed in desk can ask for them.
  if (parsed.data.team === true && !(await getAdminSession())) {
    return Response.json({ ok: false }, { status: 403 });
  }
  await getData().push.save({
    endpoint: parsed.data.endpoint,
    p256dh: parsed.data.keys.p256dh,
    auth: parsed.data.keys.auth,
    deviceId,
    ...(parsed.data.team === true ? { team: true } : {}),
  });
  return Response.json({ ok: true });
}

export async function DELETE(request: Request): Promise<Response> {
  if (!rateLimit(`push:${caller(request)}`, LIMITS.push).allowed) {
    return Response.json({ ok: false }, { status: 429 });
  }
  const parsed = Endpoint.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false }, { status: 400 });
  // Turning team alerts off keeps the phone's ordinary alerts.
  if (parsed.data.team === true) await getData().push.setTeam(parsed.data.endpoint, false);
  else await getData().push.remove(parsed.data.endpoint);
  return Response.json({ ok: true });
}
