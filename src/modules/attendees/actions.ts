'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { getData } from '@/data';
import { requireAdminApi } from '@/lib/admin-guard';
import { recordActivity } from '@/modules/admins/record';

import { applySecretariatList } from './secretariat';
import { parseStaffNos, SECRETARIAT_KEY } from './secretariat-list';

/** Saves the secretariat's staff numbers and marks them at once. */
export async function saveSecretariatList(formData: FormData): Promise<void> {
  const auth = await requireAdminApi();
  if (!auth.ok) throw new Error('Not signed in.');
  const staffNos = parseStaffNos(String(formData.get('staffNos') ?? ''));
  await getData().settings.set(SECRETARIAT_KEY, staffNos.join('\n'));
  await applySecretariatList();
  await recordActivity(
    `Saved the secretariat list (${staffNos.length} staff numbers)`,
    auth.session.operator,
  );
  revalidatePath('/', 'layout');
  redirect('/admin/attendees?secretariat=saved#secretariat');
}
