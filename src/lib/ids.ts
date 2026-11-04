/**
 * Id and token generation.
 *
 * No external library: node:crypto and the Web Crypto API are enough, and the
 * brief asks to keep dependencies minimal.
 */
import { randomBytes, randomUUID } from 'node:crypto';

/** Characters with no look-alikes, so a person can read a code aloud. */
const READABLE = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

/**
 * A sortable record id: time first, then randomness. Sorting a list of these
 * sorts by creation order, which is handy for the Q&A queue and the report.
 */
export function newId(): string {
  const stamp = Date.now().toString(36).padStart(9, '0');
  const random = randomBytes(6).toString('hex');
  return `${stamp}${random}`;
}

/** A plain UUID, where a standard format is easier to hand to another system. */
export function newUuid(): string {
  return randomUUID();
}

/**
 * The secret in a personal check-in QR code (Module 4).
 *
 * Long and random so a printed tag cannot be guessed from another one, and
 * URL safe so it can sit in a QR code without escaping.
 */
export function newCheckInToken(): string {
  return randomBytes(16).toString('base64url');
}

/**
 * A short code a person can read out or type, like "H7KQ-3M2P".
 * 8 characters from a 32 character alphabet is about 40 bits, which is plenty
 * for one event and still easy to say over a radio at the registration desk.
 */
export function newReadableCode(groups = 2, groupSize = 4): string {
  const bytes = randomBytes(groups * groupSize);
  const chars = Array.from(bytes, (byte) => READABLE[byte % READABLE.length]);
  const out: string[] = [];
  for (let i = 0; i < groups; i += 1) {
    out.push(chars.slice(i * groupSize, (i + 1) * groupSize).join(''));
  }
  return out.join('-');
}

/** Turns a title into a url-safe id that matches the config schema. */
export function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
    .replace(/-+$/g, '');
  return slug.length > 0 ? slug : 'item';
}
