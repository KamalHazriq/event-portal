/**
 * The secretariat sign in, for now.
 *
 * Brief Module 6: protected by an admin PIN from an environment variable,
 * temporary until real login exists. This is deliberately small so that
 * swapping it for Entra ID later touches this file and src/lib/auth.ts only.
 *
 * The cookie carries an operator label and an expiry, signed with the PIN.
 * It cannot be forged without knowing the PIN, and it holds no personal data,
 * only a desk label like "desk-1".
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

import { getAdminPin } from './auth';
import { plainText } from './text';

export const ADMIN_COOKIE = 'ep_desk';

/** Long enough for a full event day, short enough that a lost phone expires. */
export const SESSION_HOURS = 14;

export type AdminSession = {
  /** A desk or operator label such as "desk-1". Never a person's name. */
  operator: string;
  expiresAt: number;
};

function sign(payload: string, pin: string): string {
  return createHmac('sha256', pin).update(payload).digest('base64url');
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/** Builds the cookie value for a signed in operator. */
export function createSessionValue(operator: string, pin: string, now = Date.now()): string {
  const label = normaliseOperator(operator);
  const expiresAt = now + SESSION_HOURS * 60 * 60 * 1000;
  const payload = `${label}:${expiresAt}`;
  const encoded = Buffer.from(payload, 'utf8').toString('base64url');
  return `${encoded}.${sign(payload, pin)}`;
}

/**
 * Checks a cookie value. Returns null for anything wrong: a bad signature, a
 * tampered label, an expired session, or no PIN configured at all.
 */
export function readSessionValue(value: string | undefined, now = Date.now()): AdminSession | null {
  if (!value) return null;

  const pin = getAdminPin();
  // No PIN set means the console stays shut, rather than falling open.
  if (!pin) return null;

  const separator = value.lastIndexOf('.');
  if (separator <= 0) return null;

  const encoded = value.slice(0, separator);
  const signature = value.slice(separator + 1);

  let payload: string;
  try {
    payload = Buffer.from(encoded, 'base64url').toString('utf8');
  } catch {
    return null;
  }

  if (!safeEqual(signature, sign(payload, pin))) return null;

  const split = payload.lastIndexOf(':');
  if (split <= 0) return null;

  const operator = payload.slice(0, split);
  const expiresAt = Number(payload.slice(split + 1));
  if (!Number.isFinite(expiresAt) || expiresAt <= now) return null;

  return { operator, expiresAt };
}

/** Desk labels are short, lower case and carry no personal data. */
export function normaliseOperator(value: string): string {
  const cleaned = plainText(value, 24)
    .toLowerCase()
    .replace(/[^a-z0-9 -]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return cleaned.length > 0 ? cleaned : 'desk';
}

export const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  path: '/',
  secure: process.env.NODE_ENV === 'production',
  maxAge: SESSION_HOURS * 60 * 60,
} as const;
