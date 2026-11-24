/**
 * "Who are you?" first: before the first page, a phone or laptop says whose
 * it is, so check ins, points, photos and the door gift all link to that
 * person by themselves. Pure functions only. See logic.test.ts.
 */

/** Set for this visit when someone not on the list carries on without a name. */
export const GUEST_COOKIE = 'ep_guest';

/** The setting the secretariat can turn the question off with on the day. */
export const ASK_FIRST_KEY = 'identity.askFirst';

/** Pages that never ask: the questions themselves, and links made for one person. */
const OPEN = ['/welcome', '/door-gift', '/c/', '/committees', '/guide', '/me'];

export function asksName(pathname: string): boolean {
  return !OPEN.some((p) => pathname === p.replace(/\/$/, '') || pathname.startsWith(p));
}

/** Only our own pages, never an outside address. */
export function safeNext(value: unknown): string {
  const v = typeof value === 'string' ? value : '';
  return /^\/(?!\/)[\w\-/?=&.%#]*$/.test(v) && !v.startsWith('/welcome') ? v : '/';
}
