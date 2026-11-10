import { describe, expect, it } from 'vitest';

import {
  drawWinners,
  eligibleEntrants,
  groupDraws,
  parseDrawCount,
  resolveExclusions,
  shouldSpin,
  spinSchedule,
  SPIN_DURATION_MS,
  type DrawEntrant,
} from './logic';

/** Same seed, same draw, so the tests never flake. */
function seededRandom(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

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

describe('exclusions', () => {
  const people = [
    { id: 'a', isSecretariat: false },
    { id: 's', isSecretariat: true },
  ];

  it('keeps the secretariat out until an admin saves a list', () => {
    expect([...resolveExclusions(null, people)]).toEqual(['s']);
  });

  it('uses the saved list exactly, even if it lets the secretariat in', () => {
    expect([...resolveExclusions('[]', people)]).toEqual([]);
    expect([...resolveExclusions('["a"]', people)]).toEqual(['a']);
  });

  it('falls back to the default on a damaged setting', () => {
    expect([...resolveExclusions('not json', people)]).toEqual(['s']);
    expect([...resolveExclusions('{"a":1}', people)]).toEqual(['s']);
  });
});

describe('draw count', () => {
  it('clamps to something sensible', () => {
    expect([
      parseDrawCount('3'),
      parseDrawCount('0'),
      parseDrawCount('x'),
      parseDrawCount(500),
    ]).toEqual([3, 1, 1, 10]);
  });
});

describe('grouping draws', () => {
  it('groups winners by draw, in the order they were written, then by position', () => {
    const w = (drawId: string, position: number, drawnAt: string) => ({
      id: `${drawId === 'a' ? '1' : '2'}${position}`,
      drawId,
      position,
      drawnAt,
      prize: drawId,
      byOperator: 'desk-1',
    });
    const groups = groupDraws([
      w('b', 2, '2026-12-15T13:00:00Z'),
      w('a', 1, '2026-12-14T13:00:00Z'),
      w('b', 1, '2026-12-15T13:00:00Z'),
    ]);
    expect(groups.map((g) => [g.drawId, g.winners.map((x) => x.position)])).toEqual([
      ['a', [1]],
      ['b', [1, 2]],
    ]);
  });

  it('puts a draw written later last, even if its timestamp is earlier', () => {
    const groups = groupDraws([
      {
        id: '1',
        drawId: 'demo',
        position: 1,
        prize: '',
        drawnAt: '2026-12-14T13:00:00Z',
        byOperator: '',
      },
      {
        id: '2',
        drawId: 'today',
        position: 1,
        prize: '',
        drawnAt: '2026-11-10T07:00:00Z',
        byOperator: '',
      },
    ]);
    expect(groups.at(-1)?.drawId).toBe('today');
  });
});

describe('the spin on the big screen', () => {
  it('plays for a fresh draw and not for an old one', () => {
    expect(shouldSpin(1000, 2000)).toBe(true);
    expect(shouldSpin(1000, 1000 + 60_000)).toBe(false);
  });

  it('slows down and lasts about as long as asked', () => {
    const gaps = spinSchedule();
    const total = gaps.reduce((s, g) => s + g, 0);
    expect(total).toBeLessThanOrEqual(SPIN_DURATION_MS);
    expect(total).toBeGreaterThan(SPIN_DURATION_MS * 0.7);
    expect(gaps.at(-1)).toBeGreaterThan(gaps[0] as number);
  });
});
