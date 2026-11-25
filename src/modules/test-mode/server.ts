import { getData } from '@/data';

import { TEST_MODE_KEY, testModeFrom } from './logic';

/** Whether test mode is on. A database hiccup counts as on, so nothing disappears by accident. */
export async function testModeOn(): Promise<boolean> {
  try {
    return testModeFrom(await getData().settings.get(TEST_MODE_KEY));
  } catch {
    return true;
  }
}
