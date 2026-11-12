import { describe, expect, it } from 'vitest';

import {
  computeScores,
  POINTS,
  rankDepartments,
  rankPeople,
  shortName,
  type Score,
  type ScorePerson,
  type ScoreSources,
} from './logic';

const empty: ScoreSources = {
  links: [],
  checkIns: [],
  dayStarts: {},
  feedback: [],
  pollVotes: [],
  photos: [],
  questions: [],
};

describe('computeScores', () => {
  it('counts a check in, with the on time bonus only before the first session', () => {
    const scores = computeScores({
      ...empty,
      dayStarts: { 'day-1': '2026-12-14T01:00:00Z', 'day-2': '2026-12-15T01:00:00Z' },
      checkIns: [
        { attendeeId: 'a', dayId: 'day-1', at: '2026-12-14T00:30:00Z' },
        { attendeeId: 'a', dayId: 'day-2', at: '2026-12-15T02:00:00Z' },
      ],
    });
    expect(scores.get('a')?.total).toBe(2 * POINTS.checkIn + POINTS.onTime);
    expect(scores.get('a')?.counts.onTime).toBe(1);
  });

  it('credits what a phone did to the person it is signed in as, even from before', () => {
    const scores = computeScores({
      ...empty,
      links: [{ deviceId: 'phone-a', attendeeId: 'a' }],
      feedback: [
        { formId: 's1', deviceId: 'phone-a', attendeeId: null },
        { formId: 's2', deviceId: 'phone-x', attendeeId: null },
      ],
      pollVotes: [{ pollId: 'p1', deviceId: 'phone-a' }],
      photos: [{ id: 'ph1', deviceId: 'phone-a' }],
      questions: [{ id: 'q1', deviceId: 'phone-a' }],
    });
    expect(scores.get('a')?.total).toBe(
      POINTS.joined + POINTS.feedback + POINTS.poll + POINTS.photo + POINTS.question,
    );
    // Nobody owns phone-x, so its feedback counts for no one.
    expect(scores.size).toBe(1);
  });

  it('counts one thing once, even from two phones', () => {
    const scores = computeScores({
      ...empty,
      links: [
        { deviceId: 'p1', attendeeId: 'a' },
        { deviceId: 'p2', attendeeId: 'a' },
      ],
      pollVotes: [
        { pollId: 'poll', deviceId: 'p1' },
        { pollId: 'poll', deviceId: 'p2' },
      ],
    });
    expect(scores.get('a')?.counts).toMatchObject({ joined: 1, poll: 1 });
  });

  it('caps photos and questions', () => {
    const scores = computeScores({
      ...empty,
      links: [{ deviceId: 'p', attendeeId: 'a' }],
      photos: Array.from({ length: 10 }, (_, i) => ({ id: `ph${i}`, deviceId: 'p' })),
    });
    expect(scores.get('a')?.counts.photo).toBe(4);
  });

  it('uses a named feedback answer even without a signed in phone', () => {
    const scores = computeScores({
      ...empty,
      feedback: [{ formId: 's1', deviceId: 'x', attendeeId: 'b' }],
    });
    expect(scores.get('b')?.total).toBe(POINTS.feedback);
  });
});

const people: ScorePerson[] = [
  { id: 'a', name: 'Ann', department: 'TNS', isSecretariat: false },
  { id: 'b', name: 'Ben', department: 'TNS', isSecretariat: false },
  { id: 'c', name: 'Cat', department: 'TNS', isSecretariat: false },
  { id: 'd', name: 'Dan', department: 'GRC', isSecretariat: false },
  { id: 'e', name: 'Eve', department: 'GRC', isSecretariat: false },
  { id: 'f', name: 'Fay', department: 'GRC', isSecretariat: false },
  { id: 'g', name: 'Gus', department: 'IO', isSecretariat: false },
  { id: 's', name: 'Sam', department: 'SPTx', isSecretariat: true },
];

function scoresOf(points: Record<string, number>) {
  return new Map(
    Object.entries(points).map(([id, total]) => [
      id,
      { attendeeId: id, total, counts: {} as Score['counts'] },
    ]),
  );
}

describe('rankPeople', () => {
  it('ranks best first, shares a rank on a tie, and leaves out the secretariat', () => {
    const rows = rankPeople(scoresOf({ a: 10, b: 30, c: 30, d: 5, s: 99 }), people);
    expect(rows.map((r) => [r.rank, r.name, r.points])).toEqual([
      [1, 'Ben', 30],
      [1, 'Cat', 30],
      [3, 'Ann', 10],
      [4, 'Dan', 5],
    ]);
  });
});

describe('rankDepartments', () => {
  it('averages per person on the list, so a big team does not win by size', () => {
    const rows = rankDepartments(
      scoresOf({ a: 30, b: 0, c: 0, d: 15, e: 15, f: 15, g: 99 }),
      people,
    );
    expect(rows.map((r) => [r.rank, r.department, r.average])).toEqual([
      [1, 'GRC', 15],
      [2, 'TNS', 10],
    ]);
    // IO has one person, below the minimum team size.
    expect(rows.some((r) => r.department === 'IO')).toBe(false);
  });
});

describe('shortName', () => {
  it('keeps the given names', () => {
    expect(shortName('Aiman Hakim bin Mohd Rafi')).toBe('Aiman Hakim');
    expect(shortName('Kavitha a/p Ariaratnam')).toBe('Kavitha');
    expect(shortName('Lee Chong Wei')).toBe('Lee Chong');
    expect(shortName('Madonna')).toBe('Madonna');
  });
});
