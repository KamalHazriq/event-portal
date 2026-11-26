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
  arrivalMilestone,
  clampPodiumStep,
  parsePodiumSize,
  podiumGroups,
  safeSlidesUrl,
} from './logic';

describe('screen settings', () => {
  it('falls back to the welcome view when nothing is stored', () => {
    expect(resolveScreenSettings({ view: null, hideNames: null })).toEqual({
      view: DEFAULT_SCREEN_VIEW,
      hideNames: false,
      calm: false,
    });
  });

  it('ignores a view it does not know', () => {
    expect(resolveScreenSettings({ view: '<script>', hideNames: 'yes' })).toEqual({
      view: 'welcome',
      hideNames: false,
      calm: false,
    });
  });

  it('reads a stored view and hidden names', () => {
    expect(resolveScreenSettings({ view: 'arrivals', hideNames: 'true' })).toEqual({
      view: 'arrivals',
      hideNames: true,
      calm: false,
    });
    expect(resolveScreenSettings({ view: null, hideNames: null, calm: 'true' }).calm).toBe(true);
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

  it('welcomes the secretariat too', () => {
    expect(arrivalCards([row('1', true), row('2')], false).map((c) => c.key)).toEqual(['1', '2']);
  });
});

describe('corner clock', () => {
  it('pads and wraps', () => {
    expect(clockFromMinutes(65)).toBe('01:05');
    expect(clockFromMinutes(1440 + 30)).toBe('00:30');
  });
});

describe('guest count', () => {
  it('counts everyone, the secretariat included', () => {
    const people = [
      { id: 'a', isSecretariat: false },
      { id: 'b', isSecretariat: false },
      { id: 's', isSecretariat: true },
    ];
    expect(guestCount(people, ['a', 's', 'a'])).toEqual({ arrived: 2, expected: 3 });
  });
});

describe('arrivalMilestone', () => {
  it('celebrates each quarter, and everyone', () => {
    expect(arrivalMilestone(24)).toBeNull();
    expect(arrivalMilestone(25)?.at).toBe(25);
    expect(arrivalMilestone(64)?.text).toBe('Halfway there!');
    expect(arrivalMilestone(99)?.at).toBe(75);
    expect(arrivalMilestone(100)?.text).toContain('Everyone');
  });
});

describe('podium', () => {
  const row = (rank: number, points: number) => ({ rank, points });

  it('groups equal points into one place and keeps a tie at the cut-off together', () => {
    const rows = [row(1, 90), row(2, 80), row(3, 70), row(3, 70), row(5, 60)];
    const groups = podiumGroups(rows, 3);
    expect(groups.map((g) => [g.rank, g.people.length])).toEqual([
      [1, 1],
      [2, 1],
      [3, 2],
    ]);
  });

  it('clamps the reveal step and falls back to top 3', () => {
    expect(clampPodiumStep(99, 3)).toBe(3);
    expect(clampPodiumStep(-2, 3)).toBe(0);
    expect(parsePodiumSize('7')).toBe(3);
    expect(parsePodiumSize('10')).toBe(10);
  });
});

describe('safeSlidesUrl', () => {
  it('accepts Microsoft and Google viewers over https, including a pasted embed snippet', () => {
    expect(safeSlidesUrl('https://contoso.sharepoint.com/:p:/s/x/embed?a=1')).toBe(
      'https://contoso.sharepoint.com/:p:/s/x/embed?a=1',
    );
    expect(
      safeSlidesUrl(
        '<iframe src="https://onedrive.live.com/embed?cid=1&amp;x=2" width="476"></iframe>',
      ),
    ).toBe('https://onedrive.live.com/embed?cid=1&x=2');
  });

  it('refuses anything else', () => {
    expect(safeSlidesUrl('http://contoso.sharepoint.com/x')).toBeNull();
    expect(safeSlidesUrl('https://evil.example/x')).toBeNull();
    expect(safeSlidesUrl('javascript:alert(1)')).toBeNull();
    expect(safeSlidesUrl('')).toBeNull();
  });
});
