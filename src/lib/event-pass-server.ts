/**
 * Server side of the event pass. See event-pass.ts for how it works.
 */
import { createHash, timingSafeEqual } from 'node:crypto';

import { withPass } from './event-pass';

/** The pass from the environment, or null when the portal is open to all. */
export function eventPass(): string | null {
  const value = process.env.EVENT_PASS?.trim() ?? '';
  return value.length > 0 ? value : null;
}

/**
 * What the cookie holds: a hash, not the pass itself. A hash of the same
 * pass is the same on every server instance, so no shared state is needed.
 */
export function passDigest(pass: string): string {
  return createHash('sha256').update(`event-portal-pass:${pass}`).digest('hex');
}

/** Compares in constant time, so the answer time gives nothing away. */
export function digestMatches(offered: string | undefined, expected: string): boolean {
  if (!offered) return false;
  const a = Buffer.from(offered);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** A QR link that lets the scanner in. */
export function passLink(url: string): string {
  return withPass(url, eventPass());
}
