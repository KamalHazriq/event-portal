/**
 * Kiosk lock. Opening /kiosk marks the device, and from then on any admin
 * page sends it back to the kiosk, until someone signs in again with the
 * PIN. So an attendee at the stand cannot wander into the secretariat
 * pages, even though the tablet is signed in to record check ins.
 */
export const KIOSK_COOKIE = 'ep_kiosk';

/** Whether a request from a locked device must go back to the kiosk. */
export function kioskBlocks(pathname: string, locked: boolean): boolean {
  if (!locked) return false;
  if (pathname === '/admin/sign-in') return false; // The way out: the PIN.
  return pathname === '/admin' || pathname.startsWith('/admin/');
}
