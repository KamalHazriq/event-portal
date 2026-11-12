/**
 * The event pass: only people with the event's QR code can open the portal.
 *
 * When EVENT_PASS is set (on the hosted portal), every page asks for it.
 * The QR codes on the projector, posters and table tents carry it as
 * ?pass=..., so scanning one lets you straight in. The phone then remembers
 * it in a cookie, so it is a one time step. Without a cookie, the gate page
 * also lets you type the code, for when a QR will not scan.
 *
 * Changing EVENT_PASS signs everyone out, which is the way to shut the
 * portal after the event.
 *
 * This file is pure so the proxy, the pages and the tests can share it.
 * The hashing lives in event-pass-server.ts.
 */

export const PASS_PARAM = 'pass';
export const PASS_COOKIE = 'event_pass';
/** Long enough to cover the event and the week after, for feedback. */
export const PASS_COOKIE_MAX_AGE = 60 * 60 * 24 * 60;

/** Files every page needs before anyone has the pass: scripts, styles, logos. */
export function isOpenPath(pathname: string): boolean {
  return (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/branding/') ||
    pathname === '/favicon.ico' ||
    pathname === '/robots.txt'
  );
}

/** Adds the pass to a link, for the QR codes. Unchanged when there is no pass. */
export function withPass(url: string, pass: string | null): string {
  if (!pass) return url;
  try {
    const parsed = new URL(url);
    parsed.searchParams.set(PASS_PARAM, pass);
    return parsed.toString();
  } catch {
    return url;
  }
}

/** A link as printed under a QR code: no https://, and no pass. */
export function displayUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.searchParams.delete(PASS_PARAM);
    return parsed
      .toString()
      .replace(/^https?:\/\//, '')
      .replace(/\/$/, '');
  } catch {
    return url.replace(/^https?:\/\//, '');
  }
}
