import { describe, expect, it } from 'vitest';

import { clockState, describeOffset, latencyState, median, summarise } from './logic';

describe('device check', () => {
  it('takes the middle of the timings', () => {
    expect(median([])).toBe(0);
    expect(median([300, 100, 200])).toBe(200);
    expect(median([100, 200, 300, 400])).toBe(250);
  });

  it('grades speed and clock', () => {
    expect(latencyState(150)).toBe('good');
    expect(latencyState(800)).toBe('warn');
    expect(latencyState(2000)).toBe('bad');
    expect(clockState(-3000)).toBe('good');
    expect(clockState(30_000)).toBe('warn');
    expect(clockState(-120_000)).toBe('bad');
    expect(describeOffset(90_000)).toBe('90 seconds ahead of the server.');
    expect(describeOffset(400)).toBe('In step with the server.');
  });

  it('writes one line per check', () => {
    const text = summarise([
      { id: 'a', label: 'Camera', state: 'good', detail: 'Works' },
      { id: 'b', label: 'Alerts', state: 'bad', detail: 'Blocked' },
    ]);
    expect(text).toBe('OK   Camera: Works\nFAIL Alerts: Blocked');
  });
});
