import { cookies } from 'next/headers';

import { readTestClock, TEST_CLOCK_COOKIE } from './test-clock';
import { testModeOn } from '@/modules/test-mode/server';

import { timeOverrideAllowed } from './time';

/**
 * The time override for an attendee page: the ?now= in the address if there
 * is one, else the test clock saved on this device, else none.
 */
export async function pageNowParam(fromUrl: string | null): Promise<string | null> {
  if (fromUrl) return fromUrl;
  if (!timeOverrideAllowed() || !(await testModeOn())) return null;
  return readTestClock((await cookies()).get(TEST_CLOCK_COOKIE)?.value);
}

/** Whether this device has the test clock on (for the "Back to real time" button). */
export async function testClockOn(): Promise<boolean> {
  if (!timeOverrideAllowed() || !(await testModeOn())) return false;
  return readTestClock((await cookies()).get(TEST_CLOCK_COOKIE)?.value) !== null;
}

/** The moment saved on this device, or null when the test clock is off. */
export async function testClockMoment(): Promise<string | null> {
  if (!timeOverrideAllowed() || !(await testModeOn())) return null;
  return readTestClock((await cookies()).get(TEST_CLOCK_COOKIE)?.value);
}
