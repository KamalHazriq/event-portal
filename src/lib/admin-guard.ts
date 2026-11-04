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

import { ADMIN_COOKIE, readSessionValue, type AdminSession } from './admin-session';

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
