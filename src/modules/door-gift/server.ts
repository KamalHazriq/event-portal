import { randomInt } from 'node:crypto';

import type { Attendee } from '@/data/types';
import { getData } from '@/data';
import { getEventConfig } from '@/lib/config';
import { resolveEventNow } from '@/lib/time';

import {
  CLAIM_PREFIX,
  DOOR_GIFT_KEY,
  givenCounts,
  parseClaim,
  parseDoorGiftConfig,
  pickGift,
  spinOpen,
  type DoorGiftConfig,
  type GiftClaim,
  type GiftItem,
} from './logic';

export type DoorGiftState = {
  config: DoorGiftConfig;
  /** By attendee id. */
  claims: Map<string, GiftClaim>;
  open: boolean;
};

export async function loadDoorGifts(): Promise<DoorGiftState> {
  const event = getEventConfig();
  const all = await getData().settings.getAll();
  const config = parseDoorGiftConfig(all.find((s) => s.key === DOOR_GIFT_KEY)?.value ?? null);
  const claims = new Map<string, GiftClaim>();
  for (const s of all) {
    if (!s.key.startsWith(CLAIM_PREFIX)) continue;
    const claim = parseClaim(s.value);
    if (claim) claims.set(s.key.slice(CLAIM_PREFIX.length), claim);
  }
  const today = resolveEventNow({ timezone: event.event.timezone }).date;
  const firstDay = event.days[0]?.date === today;
  return { config, claims, open: event.features.doorGift && spinOpen(config.mode, firstDay) };
}

/** Whether this person spins (or has spun) for a gift at all. */
export function giftFor(person: Attendee, state: DoorGiftState): boolean {
  return getEventConfig().features.doorGift && (!person.isSecretariat || state.config.secretariat);
}

export function itemById(state: DoorGiftState, id: string): GiftItem | undefined {
  return state.config.items.find((i) => i.id === id);
}

// One spin at a time on this server, so two phones in the same instant can
// never both take the last of a gift.
let queue: Promise<unknown> = Promise.resolve();

/**
 * Spins for this person, once. Returns what they got (the same thing again
 * if they already spun), or null when the spin is closed or all gone.
 */
export function claimDoorGift(person: Attendee): Promise<GiftItem | null> {
  const run = queue.then(async () => {
    const state = await loadDoorGifts();
    const had = state.claims.get(person.id);
    if (had) return itemById(state, had.item) ?? null;
    if (!state.open || !giftFor(person, state)) return null;
    const item = pickGift(
      state.config.items,
      givenCounts(state.claims.values()),
      () => randomInt(0, 2 ** 32) / 2 ** 32,
    );
    if (!item) return null;
    const claim: GiftClaim = {
      item: item.id,
      at: new Date().toISOString(),
      by: 'spin',
      collected: false,
    };
    await getData().settings.set(`${CLAIM_PREFIX}${person.id}`, JSON.stringify(claim));
    return item;
  });
  queue = run.catch(() => undefined);
  return run;
}

/** Every spin forgotten, for rehearsals and Clear test data. Not an action: callers check the PIN. */
export async function removeAllClaims(): Promise<void> {
  const data = getData();
  const all = await data.settings.getAll();
  await Promise.all(
    all.filter((s) => s.key.startsWith(CLAIM_PREFIX)).map((s) => data.settings.remove(s.key)),
  );
}
