import { describe, expect, it } from 'vitest';

import { parsePickCount, parsePickerState, pickNames } from './logic';

const people = ['a', 'b', 'c', 'd'].map((id) => ({ id, name: id.toUpperCase(), department: 'X' }));

describe('the name picker', () => {
  it('picks different people, never more than there are', () => {
    const out = pickNames(people, new Set(), 10, true);
    expect(out).toHaveLength(4);
    expect(new Set(out.map((p) => p.id)).size).toBe(4);
  });

  it('skips people already picked, unless asked not to', () => {
    expect(pickNames(people, new Set(['a', 'b', 'c']), 2, true).map((p) => p.id)).toEqual(['d']);
    expect(pickNames(people, new Set(['a', 'b', 'c']), 4, false)).toHaveLength(4);
  });

  it('reads stored state safely', () => {
    expect(parsePickerState('nonsense')).toEqual({ latest: null, pickedIds: [], history: [] });
    const state = parsePickerState(
      JSON.stringify({
        latest: { id: '1', title: 'Q', at: 'x', people: [people[0]] },
        pickedIds: ['a', 3],
      }),
    );
    expect(state.latest?.people[0]?.name).toBe('A');
    expect(state.pickedIds).toEqual(['a']);
  });

  it('clamps the count', () => {
    expect(parsePickCount('0')).toBe(1);
    expect(parsePickCount('99')).toBe(10);
    expect(parsePickCount('3')).toBe(3);
  });
});
