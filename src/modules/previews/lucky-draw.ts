/**
 * The lucky draw rules, written now so the preview behaves like the real
 * thing and the real module can reuse this file as it is.
 *
 * From the brief: picks from checked in attendees only, an admin can exclude
 * names (the CDIO, the secretariat), several winners can be drawn, and no one
 * can win twice.
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
