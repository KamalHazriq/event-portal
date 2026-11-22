'use client';

import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';

import {
  enqueue,
  parseQueue,
  parseReview,
  QUEUE_KEY,
  removeById,
  REVIEW_KEY,
  reviewMessage,
  verdict,
  type QueuedCheckIn,
  type ReviewItem,
} from '../offline-queue';

/**
 * The desk's offline queue. Check ins that could not be sent are kept in the
 * browser's storage (so a reload does not lose them) and sent again when the
 * connection is back. Things the server cannot settle by itself are kept in a
 * short "needs attention" list for the desk.
 */

const listeners = new Set<() => void>();

function read(key: string): string {
  try {
    return window.localStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
}

function write(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage full or blocked: the desk still works, it just cannot save offline.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener('storage', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

function subscribeOnline(listener: () => void): () => void {
  window.addEventListener('online', listener);
  window.addEventListener('offline', listener);
  return () => {
    window.removeEventListener('online', listener);
    window.removeEventListener('offline', listener);
  };
}

const SYNC_EVERY_MS = 10_000;

export function useCheckInQueue(onSettled: () => void) {
  const rawQueue = useSyncExternalStore(
    subscribe,
    () => read(QUEUE_KEY),
    () => '',
  );
  const rawReview = useSyncExternalStore(
    subscribe,
    () => read(REVIEW_KEY),
    () => '',
  );
  const online = useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
  const queue = useMemo(() => parseQueue(rawQueue), [rawQueue]);
  const review = useMemo(() => parseReview(rawReview), [rawReview]);
  const flushing = useRef(false);
  const settled = useRef(onSettled);
  useEffect(() => {
    settled.current = onSettled;
  });

  const save = useCallback((item: QueuedCheckIn) => {
    write(QUEUE_KEY, JSON.stringify(enqueue(parseQueue(read(QUEUE_KEY)), item)));
  }, []);

  const dismiss = useCallback((id: string) => {
    write(REVIEW_KEY, JSON.stringify(removeById(parseReview(read(REVIEW_KEY)), id)));
  }, []);

  /** Sends the saved check ins oldest first, and stops at the first that cannot go. */
  const flush = useCallback(async () => {
    if (flushing.current) return;
    flushing.current = true;
    let sent = 0;
    try {
      for (const item of parseQueue(read(QUEUE_KEY))) {
        let status: number | null = null;
        let outcome: string | undefined;
        try {
          const response = await fetch('/api/check-in', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              payload: item.payload,
              attendeeId: item.attendeeId,
              cardEmail: item.cardEmail,
              dayId: item.dayId,
              method: item.method,
              at: item.queuedAt,
            }),
          });
          status = response.status;
          outcome = ((await response.json().catch(() => ({}))) as { outcome?: string }).outcome;
        } catch {
          status = null;
        }
        const decision = verdict(status, outcome);
        if (decision === 'retry') break;
        write(QUEUE_KEY, JSON.stringify(removeById(parseQueue(read(QUEUE_KEY)), item.id)));
        if (decision === 'review') {
          const next: ReviewItem = {
            id: item.id,
            message: reviewMessage(outcome),
            label: item.label ?? 'A saved check in',
            queuedAt: item.queuedAt,
          };
          write(REVIEW_KEY, JSON.stringify([...parseReview(read(REVIEW_KEY)), next]));
        }
        sent += 1;
      }
    } finally {
      flushing.current = false;
    }
    if (sent > 0) settled.current();
  }, []);

  // Try now, whenever the connection comes back, and every few seconds while any wait.
  useEffect(() => {
    if (queue.length === 0) return;
    const first = window.setTimeout(() => void flush(), 500);
    const timer = window.setInterval(() => void flush(), SYNC_EVERY_MS);
    const onOnline = () => void flush();
    window.addEventListener('online', onOnline);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
      window.removeEventListener('online', onOnline);
    };
  }, [queue.length, flush]);

  return { queue, review, online, save, dismiss, flush };
}
