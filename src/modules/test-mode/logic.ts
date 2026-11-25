/**
 * Test mode: everything that exists only for trying the portal before the
 * event. While it is on, the secretariat has the Test plan, the Tour, the
 * test clock and the test participant. Switched off, all of that goes: the
 * pages leave the menus and answer with a redirect, the pretend time stops
 * working, and the test participant is taken off the list.
 */
export const TEST_MODE_KEY = 'testmode';

/** On unless someone has switched it off, so the testing phase needs no set-up. */
export function testModeFrom(stored: string | null): boolean {
  return stored !== 'off';
}

/** The secretariat pages that only exist for testing. */
export const TEST_ONLY_PAGES = ['/admin/test-plan', '/admin/tour'] as const;
