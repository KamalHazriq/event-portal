import { describe, expect, it } from 'vitest';

import { ACTIVE_MS, agoLabel, collapseActivity, pageLabel, presenceRows } from './logic';

describe('time ago', () => {
  it('reads naturally', () => {
    expect([0, 59_000, 3 * 60_000, 60 * 60_000, 65 * 60_000, -5].map(agoLabel)).toEqual([
      'now',
      'now',
      '3 min ago',
      '1 hr ago',
      '1 hr 5 min ago',
      'now',
    ]);
  });
});

describe('who is here', () => {
  const now = new Date('2026-12-14T05:00:00Z').getTime();
  const at = (msAgo: number) => new Date(now - msAgo).toISOString();
  const seen = [
    { operator: 'desk-1', page: '/admin/desk', lastSeenAt: at(10_000) },
    { operator: 'mc', page: '/admin/live', lastSeenAt: at(5_000) },
    { operator: 'desk-2', page: '/admin/headcount', lastSeenAt: at(ACTIVE_MS + 60_000) },
  ];

  it('puts you first, then the most recently seen', () => {
    expect(presenceRows(seen, 'desk-1', now).map((r) => r.operator)).toEqual([
      'desk-1',
      'mc',
      'desk-2',
    ]);
  });

  it('marks a desk that has gone quiet', () => {
    const rows = presenceRows(seen, 'mc', now);
    expect(rows.map((r) => [r.operator, r.active])).toEqual([
      ['mc', true],
      ['desk-1', true],
      ['desk-2', false],
    ]);
    expect(rows[0]?.isYou).toBe(true);
  });
});

describe('page names', () => {
  it('turns paths into words', () => {
    expect(
      ['/admin/desk', '/screen/arrivals', '/admin/feedback/d1-keynote', '/admin/unknown'].map(
        pageLabel,
      ),
    ).toEqual(['Registration desk', 'The projector', 'Feedback', 'Admin console']);
  });
});

describe('the log', () => {
  it('folds a run of the same line from the same desk', () => {
    const e = (operator: string, action: string) => ({ operator, action, at: '' });
    const folded = collapseActivity([
      e('desk-1', 'Checked in a guest'),
      e('desk-1', 'Checked in a guest'),
      e('desk-2', 'Checked in a guest'),
      e('desk-1', 'Checked in a guest'),
      e('mc', 'Started the countdown'),
    ]);
    expect(folded.map((f) => [f.operator, f.count])).toEqual([
      ['desk-1', 2],
      ['desk-2', 1],
      ['desk-1', 1],
      ['mc', 1],
    ]);
  });
});
