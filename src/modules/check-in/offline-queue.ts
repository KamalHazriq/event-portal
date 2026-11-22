/**
 * Check ins saved on the desk's device while the connection is down, sent
 * later. Pure rules here; the storage and sending are in useCheckInQueue.ts.
 *
 * A check in is safe to send twice (the server answers "already checked in"),
 * so the queue can retry without fear.
 */
export const QUEUE_KEY = 'ep.checkin.queue.v1';
export const REVIEW_KEY = 'ep.checkin.review.v1';
export const MAX_QUEUED = 500;

export type QueuedCheckIn = {
  id: string;
  dayId: string;
  method: 'qr' | 'manual';
  /** What the scanner read (a tag token or a business card), when scanned. */
  payload?: string;
  /** The person, when picked from a list. */
  attendeeId?: string;
  cardEmail?: string;
  /** When the person was at the desk, so their arrival time is right. */
  queuedAt: string;
  /** A name for the desk to read, when it is known. */
  label?: string;
};

/** Something that could not be settled on its own and needs a person. */
export type ReviewItem = {
  id: string;
  message: string;
  label: string;
  queuedAt: string;
};

export type SyncVerdict = 'done' | 'review' | 'retry';

/** Whether a failed attempt should be saved for later: no answer, or a server fault. */
export function shouldQueue(status: number | null): boolean {
  return status === null || status >= 500;
}

/** What to do with a queued item, from the server's answer. */
export function verdict(status: number | null, outcome: string | undefined): SyncVerdict {
  if (status === null || status >= 500 || status === 429) return 'retry';
  if (outcome === 'checked-in' || outcome === 'already-checked-in') return 'done';
  return 'review';
}

function sameTarget(a: QueuedCheckIn, b: QueuedCheckIn): boolean {
  if (a.dayId !== b.dayId) return false;
  if (a.attendeeId && b.attendeeId) return a.attendeeId === b.attendeeId;
  if (a.payload && b.payload) return a.payload === b.payload;
  return false;
}

/** Adds an item, unless the same person is already waiting for that day. */
export function enqueue(queue: QueuedCheckIn[], item: QueuedCheckIn): QueuedCheckIn[] {
  if (queue.some((q) => sameTarget(q, item))) return queue;
  const next = [...queue, item];
  return next.length > MAX_QUEUED ? next.slice(next.length - MAX_QUEUED) : next;
}

export function removeById<T extends { id: string }>(list: T[], id: string): T[] {
  return list.filter((item) => item.id !== id);
}

function isQueued(value: unknown): value is QueuedCheckIn {
  const q = value as QueuedCheckIn;
  return (
    !!q &&
    typeof q.id === 'string' &&
    typeof q.dayId === 'string' &&
    (q.method === 'qr' || q.method === 'manual') &&
    typeof q.queuedAt === 'string' &&
    (typeof q.payload === 'string' || typeof q.attendeeId === 'string')
  );
}

export function parseQueue(raw: string | null): QueuedCheckIn[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value.filter(isQueued).slice(0, MAX_QUEUED) : [];
  } catch {
    return [];
  }
}

function isReview(value: unknown): value is ReviewItem {
  const r = value as ReviewItem;
  return (
    !!r &&
    typeof r.id === 'string' &&
    typeof r.message === 'string' &&
    typeof r.label === 'string' &&
    typeof r.queuedAt === 'string'
  );
}

export function parseReview(raw: string | null): ReviewItem[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value.filter(isReview).slice(0, 100) : [];
  } catch {
    return [];
  }
}

/**
 * The arrival time to record for a queued check in: the time it was queued,
 * if that is sensible (not in the future, not older than half a day).
 * Anything else is ignored and the server uses its own clock.
 */
export function clampArrivalTime(at: string | undefined, now: Date): string | undefined {
  if (!at) return undefined;
  const when = new Date(at);
  const time = when.getTime();
  if (!Number.isFinite(time)) return undefined;
  const age = now.getTime() - time;
  if (age < -60_000 || age > 12 * 60 * 60 * 1000) return undefined;
  return when.toISOString();
}

/** A short line for the desk about a queued item that needs attention. */
export function reviewMessage(outcome: string | undefined): string {
  switch (outcome) {
    case 'choose':
      return 'Matched more than one person. Check them in by name.';
    case 'card-not-found':
      return 'The business card is not on the list. Look the person up by name.';
    case 'not-found':
      return 'The tag was not recognised. Look the person up by name.';
    case 'unreadable':
      return 'The code could not be read. Scan it again.';
    default:
      return 'This one did not go through. Check the person in again.';
  }
}
