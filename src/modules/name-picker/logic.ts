/**
 * The name picker: picks people at random to speak, answer or come up.
 *
 * Separate from the lucky draw, so picking someone to talk never uses up
 * their chance of a prize. The whole state is one small setting. Pure
 * functions only. See logic.test.ts.
 */

export const PICKER_KEY = 'namePicker.state';

export const PICK_COUNTS = [1, 2, 3, 4, 5, 6, 8, 10] as const;
export const MAX_PICKER_TITLE = 80;

export type PickerPool = 'checked-in' | 'everyone';

export type Picked = { id: string; name: string; department: string };

export type PickerState = {
  /** The latest pick, shown on the big screen. */
  latest: { id: string; title: string; at: string; people: Picked[] } | null;
  /** Everyone picked so far, so nobody is picked twice until a reset. */
  pickedIds: string[];
};

export const EMPTY_PICKER: PickerState = { latest: null, pickedIds: [] };

export function parsePickerState(raw: string | null): PickerState {
  if (!raw) return EMPTY_PICKER;
  try {
    const v = JSON.parse(raw) as Partial<PickerState>;
    const latest =
      v.latest && typeof v.latest === 'object' && Array.isArray(v.latest.people)
        ? {
            id: String(v.latest.id ?? ''),
            title: String(v.latest.title ?? ''),
            at: String(v.latest.at ?? ''),
            people: v.latest.people
              .filter((p): p is Picked => typeof p?.id === 'string' && typeof p?.name === 'string')
              .map((p) => ({ id: p.id, name: p.name, department: String(p.department ?? '') })),
          }
        : null;
    const pickedIds = Array.isArray(v.pickedIds)
      ? v.pickedIds.filter((x): x is string => typeof x === 'string')
      : [];
    return { latest, pickedIds };
  } catch {
    return EMPTY_PICKER;
  }
}

/** A count from the form, clamped to what the page offers. */
export function parsePickCount(value: unknown): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) return 1;
  return Math.min(n, Math.max(...PICK_COUNTS));
}

/**
 * Picks up to `count` different people. Those already picked are skipped
 * when `fresh` is true, so everyone gets a turn before anyone goes twice.
 */
export function pickNames(
  pool: Picked[],
  pickedIds: ReadonlySet<string>,
  count: number,
  fresh: boolean,
  random: () => number = Math.random,
): Picked[] {
  const hat = pool.filter((p) => !fresh || !pickedIds.has(p.id));
  const wanted = Math.max(0, Math.min(Math.floor(count), hat.length));
  for (let i = 0; i < wanted; i += 1) {
    const j = i + Math.floor(random() * (hat.length - i));
    const swap = hat[i] as Picked;
    hat[i] = hat[j] as Picked;
    hat[j] = swap;
  }
  return hat.slice(0, wanted);
}
