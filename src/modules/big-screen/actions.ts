'use server';

import { revalidatePath } from 'next/cache';

import { getData } from '@/data';
import { requireAdminApi } from '@/lib/admin-guard';

import { isScreenView, SCREEN_KEYS } from './logic';

/**
 * The big screen switches, used from /admin/big-screen.
 *
 * Each one checks the session itself: a Server Action is a public endpoint
 * whatever page renders the form.
 */

async function assertAdmin(): Promise<void> {
  const auth = await requireAdminApi();
  if (!auth.ok) throw new Error('Not signed in.');
}

export async function setScreenView(formData: FormData): Promise<void> {
  await assertAdmin();
  const view = String(formData.get('view') ?? '');
  if (!isScreenView(view)) throw new Error('That is not a big screen view.');
  await getData().settings.set(SCREEN_KEYS.view, view);
  revalidatePath('/admin/big-screen');
}

export async function setHideNames(formData: FormData): Promise<void> {
  await assertAdmin();
  const hide = String(formData.get('hideNames') ?? '') === 'true';
  await getData().settings.set(SCREEN_KEYS.hideNames, hide ? 'true' : 'false');
  revalidatePath('/admin/big-screen');
}
