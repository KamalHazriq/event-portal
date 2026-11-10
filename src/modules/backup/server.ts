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
