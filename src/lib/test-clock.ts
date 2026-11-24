/**
 * The device test clock: the Test plan saves a moment on one phone or
 * laptop, and every attendee page on it pretends it is that moment until
 * "Back to real time" or until it runs out. Only while the time override is
 * allowed (testing), and never on the secretariat pages.
 */
export const TEST_CLOCK_COOKIE = 'ep_clock';
/** It switches itself off after this long, in case someone forgets. */
export const TEST_CLOCK_HOURS = 6;

const MOMENT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

export function testClockValue(moment: string, now = Date.now()): string | null {
  return MOMENT.test(moment) ? `${moment}~${now + TEST_CLOCK_HOURS * 3_600_000}` : null;
}

/** The moment saved on this device, if it is well formed and still in date. */
export function readTestClock(value: string | undefined, now = Date.now()): string | null {
  if (!value) return null;
  const [moment, until] = value.split('~');
  if (!moment || !MOMENT.test(moment)) return null;
  const end = Number(until);
  return Number.isFinite(end) && end > now ? moment : null;
}
