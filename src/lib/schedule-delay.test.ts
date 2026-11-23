import { afterEach, describe, expect, it } from 'vitest';

import { delayState, parseDelay } from './schedule-delay-state';
import { resolveEventNow } from './time';

afterEach(() => {
  delayState().minutes = 0;
});

describe('running late', () => {
  it('reads a stored delay as whole minutes, within two hours', () => {
    expect(parseDelay('10')).toBe(10);
    expect(parseDelay('-5')).toBe(0);
    expect(parseDelay('nope')).toBe(0);
    expect(parseDelay(null)).toBe(0);
    expect(parseDelay('500')).toBe(120);
  });

  it('moves now back by the delay, so the agenda follows the room', () => {
    // 14:00 in Kuala Lumpur.
    const real = resolveEventNow({
      timezone: 'Asia/Kuala_Lumpur',
      at: new Date('2026-12-14T06:00:00Z'),
    });
    expect(real.minutes).toBe(14 * 60);
    delayState().minutes = 15;
    // A given instant is a real moment, never shifted (countdowns use it).
    expect(
      resolveEventNow({ timezone: 'Asia/Kuala_Lumpur', at: new Date('2026-12-14T06:00:00Z') })
        .minutes,
    ).toBe(14 * 60);
    // The live clock is shifted.
    const late = resolveEventNow({ timezone: 'Asia/Kuala_Lumpur' });
    delayState().minutes = 0;
    const onTime = resolveEventNow({ timezone: 'Asia/Kuala_Lumpur' });
    const diff = (onTime.minutes - late.minutes + 24 * 60) % (24 * 60);
    expect(diff).toBe(15);
  });
});
