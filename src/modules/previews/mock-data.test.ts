import { describe, expect, it } from 'vitest';

import { mockActivity, mockOperators } from './mock-data';

describe('preview mock data', () => {
  it('shows at most three operators, with the signed in one first', () => {
    const ops = mockOperators('desk-2');
    expect(ops).toHaveLength(3);
    expect(ops[0]?.isYou).toBe(true);
    expect(ops.filter((o) => o.label === 'desk-2')).toHaveLength(1);
  });

  it('has some activity to show', () => {
    expect(mockActivity('desk-1').length).toBeGreaterThan(3);
  });
});
