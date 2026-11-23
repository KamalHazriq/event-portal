/**
 * Door gifts: the first time someone signs in on their phone, they spin for
 * one of a few gifts. The chance of each gift follows how many are left, so
 * the stock runs out evenly and never goes below zero.
 *
 * Kept in settings: one key for the gifts and stock, one key per person
 * for what they got. Pure functions only. See logic.test.ts.
 */

export const DOOR_GIFT_KEY = 'doorGift.config';
export const CLAIM_PREFIX = 'doorGift.claim.';

export type GiftItem = {
  id: string;
  name: string;
  /** How many there are in total. */
  stock: number;
  /** A picture in /public, or an https link. */
  image: string;
};

/** off: nobody spins. first-day: only on the first event day. on: any day (for testing). */
export type GiftMode = 'off' | 'first-day' | 'on';

export type DoorGiftConfig = {
  mode: GiftMode;
  /** The secretariat spin too. Off by default: gifts are for participants. */
  secretariat: boolean;
  items: GiftItem[];
};

export type GiftClaim = {
  item: string;
  at: string;
  /** "spin", or the desk that set it by hand. */
  by: string;
  collected: boolean;
};

export const DEFAULT_GIFTS: GiftItem[] = [
  { id: 'massager', name: 'Massager', stock: 30, image: '/door-gifts/massager.svg' },
  { id: 'printer', name: 'Thermal printer', stock: 30, image: '/door-gifts/printer.svg' },
  { id: 'pointer', name: 'Presentation pointer', stock: 30, image: '/door-gifts/pointer.svg' },
];

export const DEFAULT_DOOR_GIFT: DoorGiftConfig = {
  mode: 'first-day',
  secretariat: false,
  items: DEFAULT_GIFTS,
};

const MODES: readonly GiftMode[] = ['off', 'first-day', 'on'];

export function parseDoorGiftConfig(raw: string | null): DoorGiftConfig {
  if (!raw) return DEFAULT_DOOR_GIFT;
  try {
    const v = JSON.parse(raw) as Partial<DoorGiftConfig>;
    const items = Array.isArray(v.items)
      ? v.items
          .filter((i): i is GiftItem => typeof i?.id === 'string' && typeof i?.name === 'string')
          .map((i) => ({
            id: i.id,
            name: i.name,
            stock: Math.max(0, Math.floor(Number(i.stock) || 0)),
            image: typeof i.image === 'string' ? i.image : '',
          }))
      : DEFAULT_GIFTS;
    return {
      mode: MODES.includes(v.mode as GiftMode) ? (v.mode as GiftMode) : DEFAULT_DOOR_GIFT.mode,
      secretariat: v.secretariat === true,
      items: items.length > 0 ? items : DEFAULT_GIFTS,
    };
  } catch {
    return DEFAULT_DOOR_GIFT;
  }
}

export function parseClaim(raw: string | null): GiftClaim | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<GiftClaim>;
    if (typeof v.item !== 'string') return null;
    return {
      item: v.item,
      at: String(v.at ?? ''),
      by: String(v.by ?? 'spin'),
      collected: v.collected === true,
    };
  } catch {
    return null;
  }
}

/** How many of each gift have gone. */
export function givenCounts(claims: Iterable<GiftClaim>): Map<string, number> {
  const out = new Map<string, number>();
  for (const c of claims) out.set(c.item, (out.get(c.item) ?? 0) + 1);
  return out;
}

export function remaining(items: GiftItem[], given: Map<string, number>): Map<string, number> {
  return new Map(items.map((i) => [i.id, Math.max(0, i.stock - (given.get(i.id) ?? 0))]));
}

/**
 * One gift, chosen with a chance in proportion to how many are left, so a
 * gift that is nearly gone comes up less and an empty one never does.
 * Null when everything has gone.
 */
export function pickGift(
  items: GiftItem[],
  given: Map<string, number>,
  random: () => number = Math.random,
): GiftItem | null {
  const left = remaining(items, given);
  const total = items.reduce((sum, i) => sum + (left.get(i.id) ?? 0), 0);
  if (total <= 0) return null;
  let roll = random() * total;
  for (const item of items) {
    roll -= left.get(item.id) ?? 0;
    if (roll < 0) return item;
  }
  return items.findLast((i) => (left.get(i.id) ?? 0) > 0) ?? null;
}

/** Whether people can spin today. */
export function spinOpen(mode: GiftMode, todayIsFirstDay: boolean): boolean {
  return mode === 'on' || (mode === 'first-day' && todayIsFirstDay);
}

/** A safe image address: one of ours, or https. */
export function safeImage(value: string): string {
  const v = value.trim();
  return /^\/[\w./-]+$/.test(v) || /^https:\/\/[^\s"'<>]+$/.test(v) ? v : '';
}
