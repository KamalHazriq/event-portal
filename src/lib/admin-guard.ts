/**
 * Server side checks for the secretariat pages.
 *
 * The Next.js docs are explicit that a proxy (what used to be middleware) is
 * not a security boundary on its own, because a matcher change or a moved
 * route can silently drop its cover. So every admin page and every write
 * endpoint calls one of these directly.
 */
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { getData } from '@/data';

import { ADMIN_COOKIE, readSessionValue, type AdminSession } from './admin-session';

/**
 * Notes that a desk has a page open, for the "who is signed in" list. At most
 * one write per desk and page every 20 seconds, and never allowed to break
 * the page it is called from.
 */
const lastNoted = new Map<string, number>();

async function notePresence(operator: string, page: string): Promise<void> {
  const key = `${operator}:${page}`;
  const now = Date.now();
  if (now - (lastNoted.get(key) ?? 0) < 20_000) return;
  if (lastNoted.size > 200) lastNoted.clear();
  lastNoted.set(key, now);
  try {
    await getData().activity.touch(operator, page);
  } catch {
    // Presence is a convenience. A page must still load without it.
  }
}

/** Returns the signed in operator, or null. Never throws. */
export async function getAdminSession(): Promise<AdminSession | null> {
  const store = await cookies();
  return readSessionValue(store.get(ADMIN_COOKIE)?.value);
}

/**
 * For pages. Sends anyone without a session to the PIN screen, remembering
 * where they were heading so they land back there.
 */
export async function requireAdmin(returnTo: string): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) {
    redirect(`/admin/sign-in?next=${encodeURIComponent(returnTo)}`);
  }
  await notePresence(session.operator, returnTo);
  return session;
}

/** For route handlers, which answer with a status rather than a redirect. */
export async function requireAdminApi(): Promise<
  { ok: true; session: AdminSession } | { ok: false; response: Response }
> {
  const session = await getAdminSession();
  if (!session) {
    return {
      ok: false,
      response: Response.json(
        { outcome: 'error', message: 'Sign in at the desk first.' },
        { status: 401 },
      ),
    };
  }
  return { ok: true, session };
}
