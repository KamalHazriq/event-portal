/**
 * Undoing attendance undoes what hung on it: a person with no check in left
 * has no door gift and no lucky draw win. Their points follow by themselves,
 * since check in points are worked out from the check ins.
 */
import { getData } from '@/data';
import { getEventConfig } from '@/lib/config';
import { CLAIM_PREFIX } from '@/modules/door-gift/logic';

/** Everyone currently checked in on any of the given days (all days when none given). */
export async function checkedInIds(dayIds?: string[]): Promise<Set<string>> {
  const config = getEventConfig();
  const data = getData();
  const days = config.days.filter((d) => !dayIds || dayIds.includes(d.id));
  const lists = await Promise.all(days.map((d) => data.checkIns.listByDay(d.id)));
  return new Set(lists.flat().map((c) => c.attendee.id));
}

/**
 * After an undo: for these people, drop the gift and the draw win if they
 * are checked in on no day any more. Returns how many were released.
 */
export async function releaseAfterUndo(
  people: Iterable<string>,
  options: { includeGuests?: boolean } = {},
): Promise<number> {
  const data = getData();
  const still = await checkedInIds();
  const gone = [...new Set(people)].filter((id) => !still.has(id));
  await Promise.all(gone.map((id) => data.settings.remove(`${CLAIM_PREFIX}${id}`)));
  if (options.includeGuests) {
    const all = await data.settings.getAll();
    await Promise.all(
      all
        .filter((s) => s.key.startsWith(`${CLAIM_PREFIX}guest-`))
        .map((s) => data.settings.remove(s.key)),
    );
  }
  if (gone.length > 0) {
    const set = new Set(gone);
    for (const w of await data.luckyDraw.list()) {
      if (set.has(w.attendeeId)) await data.luckyDraw.remove(w.id);
    }
  }
  return gone.length;
}
