import { describe, expect, it } from 'vitest';

import {
  clampArrivalTime,
  enqueue,
  MAX_QUEUED,
  parseQueue,
  parseReview,
  removeById,
  reviewMessage,
  shouldQueue,
  verdict,
  type QueuedCheckIn,
} from './offline-queue';

const item = (over: Partial<QueuedCheckIn> = {}): QueuedCheckIn => ({
  id: 'a',
  dayId: 'day-1',
  method: 'qr',
  payload: 'TOKEN1',
  queuedAt: '2026-12-14T10:00:00.000Z',
  ...over,
});

describe('the offline check in queue', () => {
  it('saves a check in only when there was no answer or the server failed', () => {
    expect(shouldQueue(null)).toBe(true);
    expect(shouldQueue(500)).toBe(true);
    expect(shouldQueue(503)).toBe(true);
    expect(shouldQueue(429)).toBe(false);
    expect(shouldQueue(404)).toBe(false);
    expect(shouldQueue(200)).toBe(false);
  });

  it('decides what to do with each answer', () => {
    expect(verdict(200, 'checked-in')).toBe('done');
    expect(verdict(200, 'already-checked-in')).toBe('done');
    expect(verdict(null, undefined)).toBe('retry');
    expect(verdict(502, undefined)).toBe('retry');
    expect(verdict(429, 'rate-limited')).toBe('retry');
    expect(verdict(404, 'not-found')).toBe('review');
    expect(verdict(200, 'choose')).toBe('review');
    expect(verdict(404, 'card-not-found')).toBe('review');
  });

  it('does not queue the same person twice for a day', () => {
    const first = enqueue([], item());
    expect(enqueue(first, item({ id: 'b' }))).toHaveLength(1);
    expect(enqueue(first, item({ id: 'b', payload: 'TOKEN2' }))).toHaveLength(2);
    expect(enqueue(first, item({ id: 'c', dayId: 'day-2' }))).toHaveLength(2);
    const picked = enqueue([], item({ id: 'p', payload: undefined, attendeeId: 'x1' }));
    expect(enqueue(picked, item({ id: 'q', payload: undefined, attendeeId: 'x1' }))).toHaveLength(
      1,
    );
  });

  it('keeps the newest items when it is very full', () => {
    let queue: QueuedCheckIn[] = [];
    for (let i = 0; i < MAX_QUEUED + 5; i += 1) {
      queue = enqueue(queue, item({ id: `i${i}`, payload: `T${i}` }));
    }
    expect(queue).toHaveLength(MAX_QUEUED);
    expect(queue[queue.length - 1]?.id).toBe(`i${MAX_QUEUED + 4}`);
  });

  it('reads back only well formed items', () => {
    const raw = JSON.stringify([item(), { id: 'bad' }, { ...item({ id: 'c' }), method: 'sms' }]);
    expect(parseQueue(raw).map((q) => q.id)).toEqual(['a']);
    expect(parseQueue('nope')).toEqual([]);
    expect(parseQueue(null)).toEqual([]);
    expect(
      parseReview(JSON.stringify([{ id: 'r', message: 'm', label: 'l', queuedAt: 'x' }, 1])),
    ).toHaveLength(1);
  });

  it('removes by id', () => {
    expect(removeById([item(), item({ id: 'b', payload: 'T2' })], 'a').map((q) => q.id)).toEqual([
      'b',
    ]);
  });

  it('keeps a sensible arrival time, and drops a silly one', () => {
    const now = new Date('2026-12-14T10:30:00Z');
    expect(clampArrivalTime('2026-12-14T10:00:00.000Z', now)).toBe('2026-12-14T10:00:00.000Z');
    expect(clampArrivalTime('2026-12-14T11:00:00.000Z', now)).toBeUndefined(); // the future
    expect(clampArrivalTime('2026-12-13T10:00:00.000Z', now)).toBeUndefined(); // a day old
    expect(clampArrivalTime('not a date', now)).toBeUndefined();
    expect(clampArrivalTime(undefined, now)).toBeUndefined();
  });

  it('explains what needs attention', () => {
    expect(reviewMessage('choose')).toMatch(/more than one/);
    expect(reviewMessage('not-found')).toMatch(/not recognised/);
    expect(reviewMessage(undefined)).toMatch(/did not go through/);
  });
});
