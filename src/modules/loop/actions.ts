'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { getData } from '@/data';
import { requireAdminApi } from '@/lib/admin-guard';
import { newId } from '@/lib/ids';
import { plainText } from '@/lib/text';
import { recordActivity } from '@/modules/admins/record';

import {
  LOOP_KEY,
  LOOP_PHOTO_PREFIX,
  MAX_ITEMS,
  missingFromPack,
  parseFactLines,
  parseLoop,
  parseRiddleLines,
  RIDDLE_PACKS,
  safePhoto,
} from './logic';

async function assertAdmin(): Promise<string> {
  const auth = await requireAdminApi();
  if (!auth.ok) throw new Error('Not signed in.');
  return auth.session.operator;
}

/** Saves the riddles and the facts. */
export async function saveLoopText(formData: FormData): Promise<void> {
  const operator = await assertAdmin();
  const data = getData();
  const current = parseLoop(await data.settings.get(LOOP_KEY));
  await data.settings.set(
    LOOP_KEY,
    JSON.stringify({
      ...current,
      riddles: parseRiddleLines(String(formData.get('riddles') ?? '')),
      facts: parseFactLines(String(formData.get('facts') ?? '')),
    }),
  );
  await recordActivity('Edited the screensaver riddles and facts', operator);
  revalidatePath('/admin/screensaver');
  redirect('/admin/screensaver?saved=text');
}

/** Adds a new lead, or changes one (name, role, and a new photo if one was chosen). */
export async function saveLead(formData: FormData): Promise<void> {
  const operator = await assertAdmin();
  const data = getData();
  const name = plainText(String(formData.get('name') ?? ''), 80);
  const role = plainText(String(formData.get('role') ?? ''), 120);
  if (name.length < 2) redirect('/admin/screensaver?saved=name');
  const current = parseLoop(await data.settings.get(LOOP_KEY));
  const given = plainText(String(formData.get('id') ?? ''), 40);
  const existing = current.leads.find((l) => l.id === given);
  const id = existing?.id ?? newId().slice(0, 12);
  const leads = existing
    ? current.leads.map((l) => (l.id === id ? { id, name, role } : l))
    : [...current.leads, { id, name, role }];
  await data.settings.set(LOOP_KEY, JSON.stringify({ ...current, leads }));
  const photo = safePhoto(formData.get('photo'));
  if (photo) await data.settings.set(`${LOOP_PHOTO_PREFIX}${id}`, photo);
  await recordActivity(
    `${existing ? 'Changed' : 'Added'} a lead on the screensaver: ${name}`,
    operator,
  );
  revalidatePath('/admin/screensaver');
  redirect('/admin/screensaver?saved=lead#leads');
}

export async function removeLead(formData: FormData): Promise<void> {
  const operator = await assertAdmin();
  const data = getData();
  const id = plainText(String(formData.get('id') ?? ''), 40);
  const current = parseLoop(await data.settings.get(LOOP_KEY));
  await data.settings.set(
    LOOP_KEY,
    JSON.stringify({ ...current, leads: current.leads.filter((l) => l.id !== id) }),
  );
  await data.settings.remove(`${LOOP_PHOTO_PREFIX}${id}`);
  await recordActivity('Removed a lead from the screensaver', operator);
  revalidatePath('/admin/screensaver');
  redirect('/admin/screensaver?saved=removed#leads');
}

/** Adds a ready-made riddle pack, leaving out the ones already there. */
export async function addRiddlePack(formData: FormData): Promise<void> {
  const operator = await assertAdmin();
  const data = getData();
  const pack = RIDDLE_PACKS.find((p) => p.id === String(formData.get('pack') ?? ''));
  if (!pack) redirect('/admin/screensaver');
  const current = parseLoop(await data.settings.get(LOOP_KEY));
  const added = missingFromPack(current.riddles, pack);
  await data.settings.set(
    LOOP_KEY,
    JSON.stringify({ ...current, riddles: [...current.riddles, ...added].slice(0, MAX_ITEMS) }),
  );
  await recordActivity(`Added the riddle pack: ${pack.title}`, operator);
  revalidatePath('/admin/screensaver');
  redirect('/admin/screensaver?saved=pack');
}

/** Live facts (worked out from the numbers) on or off. */
export async function setLiveFacts(formData: FormData): Promise<void> {
  const operator = await assertAdmin();
  const data = getData();
  const current = parseLoop(await data.settings.get(LOOP_KEY));
  await data.settings.set(
    LOOP_KEY,
    JSON.stringify({ ...current, liveFacts: formData.get('on') === 'yes' }),
  );
  await recordActivity('Changed the screensaver live facts', operator);
  revalidatePath('/admin/screensaver');
  redirect('/admin/screensaver?saved=text');
}
