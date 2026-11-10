'use server';

import { revalidatePath } from 'next/cache';

import { getData } from '@/data';
import { requireAdminApi } from '@/lib/admin-guard';
import { getEventConfig } from '@/lib/config';
import { plainText } from '@/lib/text';
import { SCREEN_KEYS } from '@/modules/big-screen/logic';

/**
 * Photo approval. Each checks the session itself: a Server Action is a
 * public endpoint whatever page renders the form.
 */
async function assertAdmin(): Promise<string> {
  const auth = await requireAdminApi();
  if (!auth.ok) throw new Error('Not signed in.');
  if (!getEventConfig().features.photoWall) throw new Error('The photo wall is switched off.');
  return auth.session.operator;
}

function done(): void {
  revalidatePath('/admin/photos');
}

export async function reviewPhoto(formData: FormData): Promise<void> {
  const operator = await assertAdmin();
  const id = plainText(formData.get('id'), 64);
  const decision = formData.get('decision');
  const data = getData();
  if (decision === 'delete') await data.photos.remove(id);
  else if (decision === 'approved' || decision === 'rejected' || decision === 'pending') {
    await data.photos.setStatus([id], decision, operator);
  }
  done();
}

export async function approveAllWaiting(): Promise<void> {
  const operator = await assertAdmin();
  const data = getData();
  const waiting = await data.photos.list('pending');
  await data.photos.setStatus(
    waiting.map((p) => p.id),
    'approved',
    operator,
  );
  done();
}

export async function showSlideshow(): Promise<void> {
  await assertAdmin();
  await getData().settings.set(SCREEN_KEYS.view, 'photos');
  revalidatePath('/admin/big-screen');
  done();
}
