/**
 * Test mode only: a pretend arrival time for scans at the desk, so early and
 * late can be tried without waiting for the real date. A cookie on the desk's
 * own browser, so it never affects another desk. Pure rules, see logic.
 */
export const SCAN_AT_COOKIE = 'ep_scan_at';

/** A local date and time from a datetime-local input, or null. */
export function parsePretendScan(value: string | null | undefined): string | null {
  return value && /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : null;
}
