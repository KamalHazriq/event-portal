/**
 * Kiosk lock. A tablet left on a stand is signed in to the secretariat, so
 * it can be locked: opened with /kiosk?lock=1 (the Desk page has a button),
 * any admin page then asks for the PIN again, until someone enters it. So an
 * attendee at the stand cannot wander into the secretariat pages.
 *
 * Plain /kiosk does NOT lock, so the secretariat can preview it on their
 * own laptop without losing their console.
 */
export const KIOSK_COOKIE = 'ep_kiosk';

/** Whether a request from a locked device must go back to the kiosk. */
/**
 * The secretariat's pages: everything under /admin (but its sign in page and
 * app manifest), the big screen, the kiosk and the guide. The proxy sends
 * anyone without a valid sign in to the PIN screen before the page is built.
 */
export function needsAdmin(pathname: string): boolean {
  if (pathname.endsWith('/app.webmanifest')) return false;
  if (pathname === '/admin/sign-in') return false;
  return (
    pathname === '/admin' ||
    pathname.startsWith('/admin/') ||
    pathname === '/screen' ||
    pathname.startsWith('/screen/') ||
    pathname === '/kiosk' ||
    pathname === '/guide'
  );
}

export function kioskBlocks(pathname: string, locked: boolean): boolean {
  if (!locked) return false;
  if (pathname === '/admin/sign-in') return false; // The way out: the PIN.
  return pathname === '/admin' || pathname.startsWith('/admin/');
}

/** Whether this request asks to lock the device: /kiosk?lock=1. */
export function kioskLockRequested(pathname: string, search: URLSearchParams): boolean {
  return pathname === '/kiosk' && search.get('lock') === '1';
}
