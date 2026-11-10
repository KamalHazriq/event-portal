/**
 * The lucky draw rules (an extra from the brief).
 *
 * Picks from checked in attendees only, an admin can exclude names (the CDIO,
 * the secretariat), several winners can be drawn at once, and no one can win
 * twice. Pure functions only. See logic.test.ts.
 */

export type DrawEntrant = { id: string; name: string; department: string };

/** Who is still in the hat. */
export function eligibleEntrants(
  pool: DrawEntrant[],
  excludedIds: ReadonlySet<string>,
  winnerIds: ReadonlySet<string>,
): DrawEntrant[] {
  return pool.filter((p) => !excludedIds.has(p.id) && !winnerIds.has(p.id));
}

/**
 * Draws up to `count` different winners from whoever is eligible.
 * Returns fewer than asked if the hat runs out, never a repeat.
 */
export function drawWinners(
  pool: DrawEntrant[],
  excludedIds: ReadonlySet<string>,
  winnerIds: ReadonlySet<string>,
  count: number,
  random: () => number = Math.random,
): DrawEntrant[] {
  const hat = eligibleEntrants(pool, excludedIds, winnerIds);
  const wanted = Math.max(0, Math.min(Math.floor(count), hat.length));

  // Partial Fisher-Yates: shuffle only as far as we need.
  for (let i = 0; i < wanted; i += 1) {
    const j = i + Math.floor(random() * (hat.length - i));
    const swap = hat[i] as DrawEntrant;
    hat[i] = hat[j] as DrawEntrant;
    hat[j] = swap;
  }
  return hat.slice(0, wanted);
}

/* ------------------------------------------------------------- settings */

export const LUCKY_KEYS = {
  /** JSON list of attendee ids kept out of the hat. */
  excluded: 'luckyDraw.excluded',
} as const;

export const DRAW_COUNTS = [1, 2, 3, 5, 10] as const;
export const MAX_PRIZE = 80;

/**
 * Who is kept out of the hat. Until an admin saves a list, that is the
 * secretariat, as the brief suggests. Once saved, the list is exactly what
 * the admin chose, so un-ticking a secretariat member really lets them in.
 */
export function resolveExclusions(
  stored: string | null,
  people: { id: string; isSecretariat: boolean }[],
): Set<string> {
  if (stored !== null) {
    try {
      const parsed: unknown = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return new Set(parsed.filter((v): v is string => typeof v === 'string'));
      }
    } catch {
      // Fall through to the default.
    }
  }
  return new Set(people.filter((p) => p.isSecretariat).map((p) => p.id));
}

/** A count from the form, clamped to what the page offers. */
export function parseDrawCount(value: unknown): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) return 1;
  return Math.min(n, Math.max(...DRAW_COUNTS));
}

/* ---------------------------------------------------------------- draws */

export type DrawGroup<T> = {
  drawId: string;
  prize: string;
  drawnAt: string;
  byOperator: string;
  winners: T[];
};

/**
 * Winners grouped by draw, oldest first, each in the order they came out.
 *
 * "Oldest" is by record id, which is time ordered by when the row was
 * written (see newId), rather than by drawnAt. In the room the two agree; in
 * a rehearsal on demo data stamped with the event dates, a draw made today
 * would otherwise sort before them and never show as the latest.
 */
export function groupDraws<
  T extends {
    id: string;
    drawId: string;
    prize: string;
    drawnAt: string;
    byOperator: string;
    position: number;
  },
>(winners: T[]): DrawGroup<T>[] {
  const groups = new Map<string, DrawGroup<T>>();
  for (const w of winners) {
    const group = groups.get(w.drawId) ?? {
      drawId: w.drawId,
      prize: w.prize,
      drawnAt: w.drawnAt,
      byOperator: w.byOperator,
      winners: [],
    };
    group.winners.push(w);
    groups.set(w.drawId, group);
  }
  const list = [...groups.values()];
  for (const g of list) g.winners.sort((a, b) => a.position - b.position);
  const firstId = (g: DrawGroup<T>) => g.winners.reduce((m, w) => (w.id < m ? w.id : m), '\uffff');
  return list.sort((a, b) => (firstId(a) < firstId(b) ? -1 : firstId(a) > firstId(b) ? 1 : 0));
}

/**
 * How long after a draw the big screen still plays the spin when it first
 * sees it. Long enough to cover a projector that polls every few seconds,
 * short enough that reloading the page later just shows the result.
 */
export const SPIN_WINDOW_MS = 30_000;
export const SPIN_DURATION_MS = 5_000;

export function shouldSpin(drawnAtMs: number, nowMs: number): boolean {
  const age = nowMs - drawnAtMs;
  return age >= -5_000 && age < SPIN_WINDOW_MS;
}

/**
 * Gaps between names during the spin: fast at first, slowing towards the
 * end, like a wheel. Adds up to roughly the given duration.
 */
export function spinSchedule(durationMs = SPIN_DURATION_MS): number[] {
  const out: number[] = [];
  let elapsed = 0;
  let gap = 50;
  while (elapsed + gap < durationMs) {
    out.push(gap);
    elapsed += gap;
    gap = Math.round(gap * 1.08);
  }
  return out;
}
