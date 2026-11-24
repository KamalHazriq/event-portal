'use server';

import { randomInt } from 'node:crypto';

import { revalidatePath } from 'next/cache';

import { getData } from '@/data';
import { requireAdminApi } from '@/lib/admin-guard';
import { getEventConfig } from '@/lib/config';
import { shortDepartment } from '@/lib/departments';
import { newId } from '@/lib/ids';
import { plainText } from '@/lib/text';
import { resolveEventNow } from '@/lib/time';
import { recordActivity } from '@/modules/admins/record';
import { SCREEN_KEYS } from '@/modules/big-screen/logic';
import { resolveCheckInDay } from '@/modules/check-in/logic';

import {
  EMPTY_PICKER,
  MAX_PICKER_TITLE,
  parsePickCount,
  parsePickerState,
  pickNames,
  PICKER_KEY,
  type Picked,
} from './logic';

async function assertAdmin(): Promise<string> {
  const auth = await requireAdminApi();
  if (!auth.ok) throw new Error('Not signed in.');
  return auth.session.operator;
}

const secureRandom = () => randomInt(0, 2 ** 32) / 2 ** 32;

function done(): void {
  revalidatePath('/admin/name-picker');
  revalidatePath('/admin/big-screen');
}

/** Picks people, records them, and (if asked) puts the spin on the big screen. */
export async function pickPeople(formData: FormData): Promise<void> {
  const operator = await assertAdmin();
  const config = getEventConfig();
  const data = getData();
  const count = parsePickCount(formData.get('count'));
  const title = plainText(formData.get('title'), MAX_PICKER_TITLE);
  const fromEveryone = formData.get('pool') === 'everyone';
  const fresh = formData.get('fresh') === 'on';
  const withSecretariat = formData.get('secretariat') === 'on';

  let people;
  if (fromEveryone) {
    people = await data.attendees.list();
  } else {
    const day = resolveCheckInDay(
      config.days,
      resolveEventNow({ timezone: config.event.timezone }),
    );
    people = day ? (await data.checkIns.listByDay(day.id)).map((c) => c.attendee) : [];
  }
  const pool: Picked[] = people
    .filter((p) => withSecretariat || !p.isSecretariat)
    .map((p) => ({ id: p.id, name: p.name, department: shortDepartment(config, p.department) }));

  const state = parsePickerState(await data.settings.get(PICKER_KEY));
  const picked = pickNames(pool, new Set(state.pickedIds), count, fresh, secureRandom);
  if (picked.length === 0) return;

  await data.settings.set(
    PICKER_KEY,
    JSON.stringify({
      latest: {
        id: newId(),
        title,
        at: new Date().toISOString(),
        people: picked,
        fun: formData.get('fun') === 'on',
      },
      pickedIds: [...new Set([...state.pickedIds, ...picked.map((p) => p.id)])],
    }),
  );
  if (formData.get('showOnScreen') === 'on')
    await data.settings.set(SCREEN_KEYS.view, 'name-picker');
  await recordActivity(`Picked ${picked.map((p) => p.name).join(', ')}`, operator);
  done();
}

/** Everyone can be picked again. */
export async function resetPicker(): Promise<void> {
  const operator = await assertAdmin();
  await getData().settings.set(PICKER_KEY, JSON.stringify(EMPTY_PICKER));
  await recordActivity('Reset the name picker', operator);
  done();
}
