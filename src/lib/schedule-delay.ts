/**
 * "We are running 10 minutes late": set on the Live control page, it moves
 * the portal's idea of now back by that much, so "Happening now", the next
 * session, reactions and feedback reminders follow the real room instead of
 * the printed times. Server only. Re-read at most every two seconds.
 */
import { getData } from '@/data';

import { delayState, parseDelay } from './schedule-delay-state';

export const DELAY_KEY = 'schedule.delayMinutes';
const RECHECK_MS = 2_000;

export async function refreshScheduleDelay(force = false): Promise<void> {
  const state = delayState();
  if (!force && Date.now() - state.checkedAt < RECHECK_MS) return;
  if (state.inflight) return state.inflight;
  state.inflight = (async () => {
    try {
      state.minutes = parseDelay(await getData().settings.get(DELAY_KEY));
      state.checkedAt = Date.now();
    } catch {
      // Keep the last value; try again on the next request.
    } finally {
      state.inflight = null;
    }
  })();
  return state.inflight;
}

export async function storeScheduleDelay(minutes: number): Promise<void> {
  const value = parseDelay(String(minutes));
  await getData().settings.set(DELAY_KEY, String(value));
  const state = delayState();
  state.minutes = value;
  state.checkedAt = Date.now();
}
