'use server';

import { revalidatePath } from 'next/cache';

import { requireAdminApi } from '@/lib/admin-guard';
import { getEventConfig } from '@/lib/config';
import { newId } from '@/lib/ids';
import { localDateTimeToInstant } from '@/lib/time';

import { loadReminders, saveReminders } from './dispatch';
import { isLocalDateTime, MAX_REMINDER_CHARS, MAX_REMINDERS, type Reminder } from './logic';

async function assertAdmin(): Promise<void> {
  const auth = await requireAdminApi();
  if (!auth.ok) throw new Error('Not signed in.');
}

const BACK = '/admin/announce';

export async function addReminder(formData: FormData): Promise<void> {
  await assertAdmin();
  const at = String(formData.get('at') ?? '').trim();
  const text = String(formData.get('text') ?? '')
    .trim()
    .slice(0, MAX_REMINDER_CHARS);
  const audience = formData.get('audience') === 'everyone' ? 'everyone' : 'team';
  const valid =
    text.length > 0 &&
    isLocalDateTime(at) &&
    localDateTimeToInstant(at, getEventConfig().event.timezone) !== null;
  if (!valid) return;
  const list = await loadReminders();
  if (list.length >= MAX_REMINDERS) return;
  const reminder: Reminder = { id: newId(), at, text, audience };
  await saveReminders([...list, reminder]);
  revalidatePath(BACK);
}

export async function deleteReminder(formData: FormData): Promise<void> {
  await assertAdmin();
  const id = String(formData.get('id') ?? '');
  await saveReminders((await loadReminders()).filter((r) => r.id !== id));
  revalidatePath(BACK);
}
