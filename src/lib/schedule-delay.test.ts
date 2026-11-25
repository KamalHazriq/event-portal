import { describe, expect, it } from 'vitest';

import { parseDelay } from './schedule-delay-state';

describe('parseDelay', () => {
  it('keeps whole minutes, late or early, within three hours', () => {
    expect(parseDelay('10')).toBe(10);
    expect(parseDelay('-15')).toBe(-15);
    expect(parseDelay('500')).toBe(180);
    expect(parseDelay('-500')).toBe(-180);
    expect(parseDelay('abc')).toBe(0);
    expect(parseDelay(null)).toBe(0);
  });
});
