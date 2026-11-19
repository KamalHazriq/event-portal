'use server';

import { revalidatePath } from 'next/cache';

import { getData } from '@/data';
import { requireAdminApi } from '@/lib/admin-guard';
import { isPortalStyle, STYLE_INFO, STYLE_KEY } from '@/lib/look';
import { recordActivity } from '@/modules/admins/record';

/** Switches the whole portal to another style. Colours stay as they are. */
export async function setStyle(formData: FormData): Promise<void> {
  const auth = await requireAdminApi();
  if (!auth.ok) throw new Error('Not signed in.');
  const style = formData.get('style');
  if (!isPortalStyle(style)) return;
  await getData().settings.set(STYLE_KEY, style);
  await recordActivity(`Switched the portal to the ${STYLE_INFO[style].title} style`);
  revalidatePath('/', 'layout');
}
