import { describe, expect, it } from 'vitest';

import { cueNeighbours } from './cues';

describe('cueNeighbours', () => {
  const all = ['welcome', 'countdown', 'qa', 'poll', 'podium'] as const;

  it('gives the views either side, skipping views that are off', () => {
    expect(cueNeighbours('qa', all)).toEqual({ prev: 'countdown', next: 'poll' });
  });

  it('has no previous at the start and no next at the end', () => {
    expect(cueNeighbours('welcome', all).prev).toBeNull();
    expect(cueNeighbours('podium', all).next).toBeNull();
  });

  it('starts from the first cue when the view is not in the order', () => {
    expect(cueNeighbours('arrivals', all)).toEqual({ prev: null, next: 'welcome' });
  });
});
