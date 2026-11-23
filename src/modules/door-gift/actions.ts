'use server';

import { revalidatePath } from 'next/cache';

import { getData } from '@/data';
import { requireAdminApi } from '@/lib/admin-guard';
import { plainText } from '@/lib/text';
import { recordActivity } from '@/modules/admins/record';

import { removeAllClaims } from './server';

import {
  CLAIM_PREFIX,
  DOOR_GIFT_KEY,
  parseClaim,
  parseDoorGiftConfig,
  safeImage,
  type GiftClaim,
  type GiftItem,
  type GiftMode,
} from './logic';

async function assertAdmin(): Promise<string> {
  const auth = await requireAdminApi();
  if (!auth.ok) throw new Error('Not signed in.');
  return auth.session.operator;
}

function done(): void {
  revalidatePath('/admin/door-gifts');
  revalidatePath('/door-gift');
  revalidatePath('/', 'layout');
}

function slug(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 30) || 'gift'
  );
}

/** The gifts, their stock and pictures, and when the spin is open. */
export async function saveDoorGiftSettings(formData: FormData): Promise<void> {
  const operator = await assertAdmin();
  const data = getData();
  const before = parseDoorGiftConfig(await data.settings.get(DOOR_GIFT_KEY));
  const mode = String(formData.get('mode'));
  const items: GiftItem[] = [];
  const taken = new Set<string>();
  for (let j = 0; j < 12; j += 1) {
    const name = plainText(formData.get(`g${j}.name`), 60);
    if (!name || formData.get(`g${j}.remove`) === 'on') continue;
    let id = plainText(formData.get(`g${j}.id`), 40) || slug(name);
    while (taken.has(id)) id = `${id}-2`;
    taken.add(id);
    items.push({
      id,
      name,
      stock: Math.max(0, Math.min(9999, Math.floor(Number(formData.get(`g${j}.stock`)) || 0))),
      image: safeImage(String(formData.get(`g${j}.image`) ?? '')) || '/door-gifts/massager.svg',
    });
  }
  await data.settings.set(
    DOOR_GIFT_KEY,
    JSON.stringify({
      mode: (['off', 'first-day', 'on'] as const).includes(mode as GiftMode) ? mode : before.mode,
      secretariat: formData.get('secretariat') === 'on',
      items: items.length > 0 ? items : before.items,
    }),
  );
  await recordActivity('Changed the door gift settings', operator);
  done();
}

/** Gives someone a gift by hand, changes it, or ('' ) takes it back so they can spin again. */
export async function setDoorGift(formData: FormData): Promise<void> {
  const operator = await assertAdmin();
  const data = getData();
  const attendeeId = plainText(formData.get('attendeeId'), 64);
  const item = plainText(formData.get('item'), 40);
  const person = attendeeId ? await data.attendees.get(attendeeId) : null;
  if (!person) return;
  const key = `${CLAIM_PREFIX}${person.id}`;
  if (!item) {
    await data.settings.remove(key);
    await recordActivity(`Took back the door gift of ${person.name}`, operator);
  } else {
    const config = parseDoorGiftConfig(await data.settings.get(DOOR_GIFT_KEY));
    const gift = config.items.find((i) => i.id === item);
    if (!gift) return;
    const had = parseClaim(await data.settings.get(key));
    const claim: GiftClaim = {
      item: gift.id,
      at: had?.at ?? new Date().toISOString(),
      by: operator,
      collected: had?.collected ?? false,
    };
    await data.settings.set(key, JSON.stringify(claim));
    await recordActivity(`Set the door gift of ${person.name} to ${gift.name}`, operator);
  }
  done();
}

/** Ticks a gift as handed over at the desk, or unticks it. */
export async function toggleCollected(formData: FormData): Promise<void> {
  await assertAdmin();
  const data = getData();
  const attendeeId = plainText(formData.get('attendeeId'), 64);
  const key = `${CLAIM_PREFIX}${attendeeId}`;
  const claim = parseClaim(await data.settings.get(key));
  if (!claim) return;
  await data.settings.set(key, JSON.stringify({ ...claim, collected: !claim.collected }));
  done();
}

/** For rehearsals: everyone can spin again. The gifts and stock stay. */
export async function clearDoorGifts(formData: FormData): Promise<void> {
  const operator = await assertAdmin();
  if (formData.get('confirm') !== 'yes') return;
  await removeAllClaims();
  await recordActivity('Cleared every door gift spin', operator);
  done();
}
