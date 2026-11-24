import { describe, expect, it } from 'vitest';

import { readTestClock, TEST_CLOCK_HOURS, testClockValue } from './test-clock';

describe('the device test clock', () => {
  it('keeps a moment for a few hours, then lets it go', () => {
    const saved = testClockValue('2026-12-14T15:10', 0)!;
    expect(readTestClock(saved, 1000)).toBe('2026-12-14T15:10');
    expect(readTestClock(saved, TEST_CLOCK_HOURS * 3_600_000 + 1)).toBeNull();
  });

  it('refuses anything that is not a moment', () => {
    expect(testClockValue('tomorrow')).toBeNull();
    expect(readTestClock('2026-12-14T15:10~nope')).toBeNull();
    expect(readTestClock(undefined)).toBeNull();
  });
});
