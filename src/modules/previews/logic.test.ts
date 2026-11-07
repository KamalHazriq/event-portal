import { describe, expect, it } from 'vitest';

import { getEventConfig } from '@/lib/config';
import { buildAgenda } from '@/modules/schedule/logic';

import { drawWinners, eligibleEntrants, type DrawEntrant } from './lucky-draw';
import {
  mockCommitteeItems,
  mockOperators,
  mockPhotos,
  mockPolls,
  mockQuestions,
  MOCK_NAMES,
  seededRandom,
} from './mock-data';

const pool: DrawEntrant[] = Array.from({ length: 10 }, (_, i) => ({
  id: `a${i}`,
  name: `Person ${i}`,
  department: 'Dept',
}));

describe('lucky draw', () => {
  it('never draws an excluded person or a past winner', () => {
    const excluded = new Set(['a0', 'a1']);
    const winners = new Set(['a2']);
    for (let seed = 1; seed < 50; seed += 1) {
      const drawn = drawWinners(pool, excluded, winners, 3, seededRandom(seed));
      expect(drawn).toHaveLength(3);
      for (const d of drawn) {
        expect(excluded.has(d.id)).toBe(false);
        expect(winners.has(d.id)).toBe(false);
      }
    }
  });

  it('never draws the same person twice in one go', () => {
    const drawn = drawWinners(pool, new Set(), new Set(), 10, seededRandom(9));
    expect(new Set(drawn.map((d) => d.id)).size).toBe(10);
  });

  it('returns fewer winners when the hat runs out, rather than repeating', () => {
    const drawn = drawWinners(pool, new Set(['a0', 'a1', 'a2']), new Set(['a3']), 20);
    expect(drawn).toHaveLength(6);
  });

  it('handles nonsense counts', () => {
    expect(drawWinners(pool, new Set(), new Set(), -2)).toEqual([]);
    expect(drawWinners(pool, new Set(), new Set(), 1.9)).toHaveLength(1);
  });

  it('does not change the pool it was given', () => {
    const copy = pool.map((p) => p.id);
    drawWinners(pool, new Set(), new Set(), 5, seededRandom(3));
    expect(pool.map((p) => p.id)).toEqual(copy);
  });

  it('lists who is still eligible', () => {
    expect(eligibleEntrants(pool, new Set(['a0']), new Set(['a1']))).toHaveLength(8);
  });
});

describe('preview mock data', () => {
  const agenda = buildAgenda(getEventConfig());

  it('is the same every time', () => {
    expect(mockQuestions(agenda.sessions)).toEqual(mockQuestions(agenda.sessions));
    expect(mockPhotos()).toEqual(mockPhotos());
    expect(mockPolls(78)).toEqual(mockPolls(78));
  });

  it('only gives questions to sessions with Q&A switched on', () => {
    const qaIds = new Set(agenda.sessions.filter((s) => s.qaEnabled).map((s) => s.id));
    for (const q of mockQuestions(agenda.sessions)) expect(qaIds.has(q.sessionId)).toBe(true);
  });

  it('pins at most one approved question per session', () => {
    const pinned = mockQuestions(agenda.sessions).filter((q) => q.pinned);
    expect(new Set(pinned.map((q) => q.sessionId)).size).toBe(pinned.length);
    for (const q of pinned) expect(q.status).toBe('approved');
  });

  it('keeps poll vote totals honest for single choice polls', () => {
    for (const poll of mockPolls(78).filter((p) => p.kind === 'single')) {
      expect(poll.options.reduce((sum, o) => sum + o.votes, 0)).toBe(poll.voters);
    }
  });

  it('uses only invented names, never the attendee list', () => {
    const invented = new Set<string>([...MOCK_NAMES, 'Anonymous']);
    for (const q of mockQuestions(agenda.sessions)) expect(invented.has(q.name)).toBe(true);
  });

  it('shows at most three operators, with the signed in one first', () => {
    const ops = mockOperators('desk-2');
    expect(ops).toHaveLength(3);
    expect(ops[0]?.isYou).toBe(true);
    expect(ops.filter((o) => o.label === 'desk-2')).toHaveLength(1);
  });

  it('gives SVC the most committee rows', () => {
    const items = mockCommitteeItems();
    expect(items.SVC.length).toBeGreaterThan(items.ATC.length);
  });
});
