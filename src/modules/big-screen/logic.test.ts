import { describe, expect, it } from 'vitest';

import {
  arrivalCards,
  clockFromMinutes,
  DEFAULT_SCREEN_VIEW,
  formatCountdownDigits,
  guestCount,
  isScreenView,
  resolveScreenSettings,
  SCREEN_POLL_MS,
  SCREEN_VIEW_INFO,
  SCREEN_VIEWS,
} from './logic';

describe('screen settings', () => {
  it('falls back to the welcome view when nothing is stored', () => {
    expect(resolveScreenSettings({ view: null, hideNames: null })).toEqual({
      view: DEFAULT_SCREEN_VIEW,
      hideNames: false,
    });
  });

  it('ignores a view it does not know', () => {
    expect(resolveScreenSettings({ view: '<script>', hideNames: 'yes' })).toEqual({
      view: 'welcome',
      hideNames: false,
    });
  });

  it('reads a stored view and hidden names', () => {
    expect(resolveScreenSettings({ view: 'arrivals', hideNames: 'true' })).toEqual({
      view: 'arrivals',
      hideNames: true,
    });
  });

  it('describes every view', () => {
    for (const view of SCREEN_VIEWS) {
      expect(isScreenView(view)).toBe(true);
      expect(SCREEN_VIEW_INFO[view].title.length).toBeGreaterThan(0);
    }
  });

  it('polls inside the three to five seconds the brief asks for', () => {
    expect(SCREEN_POLL_MS).toBeGreaterThanOrEqual(3000);
    expect(SCREEN_POLL_MS).toBeLessThanOrEqual(5000);
  });
});

describe('countdown digits', () => {
  it.each([
    [15 * 60_000, '15:00'],
    [14 * 60_000 + 59_500, '15:00'],
    [59_000, '0:59'],
    [500, '0:01'],
    [0, '0:00'],
    [-5000, '0:00'],
    [3_600_000 + 4 * 60_000 + 9_000, '1:04:09'],
    [86_400_000 + 3_600_000, '1 day 1:00:00'],
    [38 * 86_400_000 + 9_000, '38 days 0:00:09'],
  ])('%i ms shows %s', (ms, expected) => {
    expect(formatCountdownDigits(ms)).toBe(expected);
  });
});

describe('arrival cards', () => {
  const row = (id: string, isSecretariat = false) => ({
    id,
    attendee: { name: `Name ${id}`, department: 'Dept', isSecretariat },
  });

  it('shows newest first, up to the limit', () => {
    const cards = arrivalCards([row('1'), row('2'), row('3')], false, 2);
    expect(cards.map((c) => c.key)).toEqual(['1', '2']);
  });

  it('shows no names at all when names are hidden', () => {
    expect(arrivalCards([row('1'), row('2')], true)).toEqual([]);
  });

  it('leaves the secretariat off the welcome wall', () => {
    expect(arrivalCards([row('1', true), row('2')], false).map((c) => c.key)).toEqual(['2']);
  });
});

describe('corner clock', () => {
  it('pads and wraps', () => {
    expect(clockFromMinutes(65)).toBe('01:05');
    expect(clockFromMinutes(1440 + 30)).toBe('00:30');
  });
});

describe('guest count', () => {
  it('leaves the secretariat out of both numbers', () => {
    const people = [
      { id: 'a', isSecretariat: false },
      { id: 'b', isSecretariat: false },
      { id: 's', isSecretariat: true },
    ];
    expect(guestCount(people, ['a', 's', 'a'])).toEqual({ arrived: 1, expected: 2 });
  });
});
