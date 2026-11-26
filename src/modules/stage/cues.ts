/**
 * Next cue / Previous cue on the stage console: the order a programme
 * usually runs in. The press is always manual; the agenda only suggests.
 * Pure functions, see cues.test.ts.
 */
import type { ScreenView } from '@/modules/big-screen/logic';

export const CUE_ORDER: readonly ScreenView[] = [
  'welcome',
  'arrivals',
  'countdown',
  'now-next',
  'qa',
  'poll',
  'comments',
  'lucky-draw',
  'name-picker',
  'photos',
  'leaderboard',
  'podium',
  'feedback',
  'loop',
  'slides',
];

/** The views either side of the one on screen, in cue order, skipping views that are off. */
export function cueNeighbours(
  current: ScreenView,
  available: readonly ScreenView[],
): { prev: ScreenView | null; next: ScreenView | null } {
  const order = CUE_ORDER.filter((v) => available.includes(v));
  const at = order.indexOf(current);
  if (order.length === 0) return { prev: null, next: null };
  if (at < 0) return { prev: null, next: order[0] ?? null };
  return { prev: order[at - 1] ?? null, next: order[at + 1] ?? null };
}
