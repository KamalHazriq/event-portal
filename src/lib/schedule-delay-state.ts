/**
 * How far the event is running behind, in minutes, as this server copy last
 * read it. No imports, so the clock (time.ts) can read it anywhere; the
 * value is kept fresh by schedule-delay.ts on the server. In the browser it
 * is always 0: pages get their times from the server.
 */
type State = { minutes: number; checkedAt: number; inflight: Promise<void> | null };

const KEY = Symbol.for('event-portal.schedule-delay');
const store = globalThis as unknown as Record<symbol, State | undefined>;

export function delayState(): State {
  return (store[KEY] ??= { minutes: 0, checkedAt: 0, inflight: null });
}

export function scheduleDelayMinutes(): number {
  return delayState().minutes;
}

export const DELAY_CHOICES = [0, 5, 10, 15, 20, 30, 45, 60] as const;
export const MAX_DELAY_MINUTES = 120;

/** A stored value as whole minutes between 0 and two hours. */
export function parseDelay(raw: string | null | undefined): number {
  const value = Math.round(Number(raw ?? 0));
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.min(value, MAX_DELAY_MINUTES);
}
