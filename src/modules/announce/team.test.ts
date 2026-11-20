import { describe, expect, it } from 'vitest';

import { alertDue, TEAM_ALERT_GAP_MS, teamAutoOn } from './team';

describe('team alerts', () => {
  it('are on unless switched off', () => {
    expect(teamAutoOn(null)).toBe(true);
    expect(teamAutoOn('on')).toBe(true);
    expect(teamAutoOn('off')).toBe(false);
  });

  it('send once, then wait a few minutes before the next of the same kind', () => {
    expect(alertDue(undefined, 1_000)).toBe(true);
    expect(alertDue(1_000, 1_000 + TEAM_ALERT_GAP_MS - 1)).toBe(false);
    expect(alertDue(1_000, 1_000 + TEAM_ALERT_GAP_MS)).toBe(true);
  });
});
