/**
 * Shared server pieces for the backup Q&A and polls: the on/off switch, and
 * the phone's device id inside a route handler.
 */
import { cookies } from 'next/headers';

import { getData } from '@/data';
import { DEVICE_COOKIE, deviceCookieOptions, newDeviceId, readDeviceId } from '@/lib/device';
import { isBackupOn, QA_KEYS } from '@/modules/qa/logic';

/** True while the portal's own Q&A and polls stand in for Slido. */
export async function readBackupMode(): Promise<boolean> {
  return isBackupOn(await getData().settings.get(QA_KEYS.backupMode));
}

/** The phone's id, without issuing one. For pages. */
export async function currentDeviceId(): Promise<string | null> {
  const store = await cookies();
  return readDeviceId(store.get(DEVICE_COOKIE)?.value);
}

/** The phone's id, issuing one on first use. For route handlers and actions. */
export async function deviceIdOrNew(): Promise<string> {
  const store = await cookies();
  const existing = readDeviceId(store.get(DEVICE_COOKIE)?.value);
  if (existing) return existing;
  const fresh = newDeviceId();
  store.set(DEVICE_COOKIE, fresh, deviceCookieOptions);
  return fresh;
}

/**
 * Answers a form post. A phone gets a redirect back to the page with a short
 * state code (so it works with no JavaScript); a script that asks for JSON,
 * such as the load test, gets JSON.
 */
export function respond(
  request: Request,
  path: string,
  state: string,
  ok: boolean,
  status = ok ? 200 : 400,
): Response {
  if ((request.headers.get('accept') ?? '').includes('application/json')) {
    return Response.json({ ok, state }, { status });
  }
  const join = path.includes('?') ? '&' : '?';
  return new Response(null, {
    status: 303,
    headers: { Location: `${path}${join}state=${encodeURIComponent(state)}` },
  });
}

/**
 * The phone's id for signing in as this person. A phone that was someone
 * else's starts afresh under a new id, so what it did before (photos,
 * reactions, comments) stays with the person who did it.
 */
export async function deviceIdFor(attendeeId: string): Promise<string> {
  const deviceId = await deviceIdOrNew();
  const owner = await getData().players.ownerOf(deviceId);
  if (!owner || owner === attendeeId) return deviceId;
  const fresh = newDeviceId();
  (await cookies()).set(DEVICE_COOKIE, fresh, deviceCookieOptions);
  return fresh;
}

/** A new id for this phone, so what it did before is never counted for the next person. */
export async function startFreshDevice(): Promise<void> {
  (await cookies()).set(DEVICE_COOKIE, newDeviceId(), deviceCookieOptions);
}
