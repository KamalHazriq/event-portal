/**
 * The device id used to keep one feedback submission per phone.
 *
 * A cookie rather than localStorage, so the feedback form works with no
 * JavaScript at all. That matters on hotel Wi-Fi, where a page that needs a
 * script to submit is a page that sometimes does not submit.
 *
 * It identifies a browser, not a person. It is random, it is never shown, and
 * nothing links it to a name. Clearing site data gets you a new one, which is
 * fine: this is politeness, not security.
 */
import { randomBytes } from 'node:crypto';

export const DEVICE_COOKIE = 'ep_device';

/** Long enough to outlast the event. */
export const DEVICE_COOKIE_MAX_AGE = 30 * 24 * 60 * 60;

const PATTERN = /^[A-Za-z0-9_-]{16,64}$/;

export function newDeviceId(): string {
  return randomBytes(16).toString('base64url');
}

/** Returns the id only if it looks like one we issued. */
export function readDeviceId(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return PATTERN.test(trimmed) ? trimmed : null;
}

export const deviceCookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  path: '/',
  secure: process.env.NODE_ENV === 'production',
  maxAge: DEVICE_COOKIE_MAX_AGE,
} as const;
