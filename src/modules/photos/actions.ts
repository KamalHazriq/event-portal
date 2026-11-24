'use server';

import { revalidatePath } from 'next/cache';

import { getData } from '@/data';
import { requireAdminApi } from '@/lib/admin-guard';
import { getEventConfig } from '@/lib/config';
import { plainText } from '@/lib/text';
import { SCREEN_KEYS } from '@/modules/big-screen/logic';
import { PHOTO_KEYS, PHOTO_LAYOUT_INFO, resolvePhotoLayout } from '@/modules/photos/logic';
import { forgetImages } from './image-cache';
import { recordActivity } from '@/modules/admins/record';

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
  // Whatever happens to it, this server stops serving it from memory.
  forgetImages([id]);
  if (decision === 'delete') {
    await data.photos.remove(id);
    await recordActivity('Deleted a photo', operator);
  } else if (decision === 'approved' || decision === 'rejected' || decision === 'pending') {
    await data.photos.setStatus([id], decision, operator);
    await recordActivity(
      decision === 'approved' ? 'Approved a photo' : 'Rejected a photo',
      operator,
    );
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
  await recordActivity(`Approved ${waiting.length} waiting photos`, operator);
  done();
}

export async function showSlideshow(): Promise<void> {
  await assertAdmin();
  await getData().settings.set(SCREEN_KEYS.view, 'photos');
  await recordActivity('Put the photo wall on the big screen');
  revalidatePath('/admin/big-screen');
  done();
}

/** Approval first, or straight onto the wall. */
export async function setPhotoModeration(formData: FormData): Promise<void> {
  const operator = await assertAdmin();
  const on = formData.get('mode') === 'on';
  await getData().settings.set(PHOTO_KEYS.moderation, on ? 'on' : 'off');
  await recordActivity(
    on ? 'Turned photo approval on' : 'Turned photo approval off: photos go straight up',
    operator,
  );
  done();
}

/** How the big screen lays the photos out: slideshow, grid or mosaic. */
export async function setPhotoLayout(formData: FormData): Promise<void> {
  const operator = await assertAdmin();
  const layout = resolvePhotoLayout(String(formData.get('layout') ?? ''));
  await getData().settings.set(PHOTO_KEYS.layout, layout);
  await recordActivity(`Set the photo wall to ${PHOTO_LAYOUT_INFO[layout].title}`, operator);
  revalidatePath('/admin/big-screen');
  done();
}
