'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';

import { requireAdminApi } from '@/lib/admin-guard';
import { testModeOn } from '@/modules/test-mode/server';

import { parsePretendScan, SCAN_AT_COOKIE } from './pretend';

/** Sets or clears this desk's pretend scan time. Only while test mode is on. */
export async function setPretendScan(formData: FormData): Promise<void> {
  const auth = await requireAdminApi();
  if (!auth.ok) throw new Error('Not signed in.');
  const jar = await cookies();
  const value = parsePretendScan(String(formData.get('at') ?? ''));
  if (formData.get('clear') === 'yes' || !value || !(await testModeOn())) {
    jar.delete(SCAN_AT_COOKIE);
  } else {
    jar.set(SCAN_AT_COOKIE, value, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 12 * 60 * 60,
    });
  }
  revalidatePath('/admin/desk');
}
