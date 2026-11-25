'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { getData } from '@/data';
import { requireAdminApi } from '@/lib/admin-guard';
import { TEST_CLOCK_COOKIE } from '@/lib/test-clock';
import { recordActivity } from '@/modules/admins/record';
import { TEST_STAFF_NO } from '@/modules/checklist/test-participant';

import { TEST_MODE_KEY } from './logic';

/**
 * Test mode on or off. Off takes the test participant off the list and ends
 * this device's pretend time; the testing pages stop being offered.
 */
export async function setTestMode(formData: FormData): Promise<void> {
  const auth = await requireAdminApi();
  if (!auth.ok) throw new Error('Not signed in.');
  const on = String(formData.get('mode') ?? '') === 'on';
  const data = getData();
  await data.settings.set(TEST_MODE_KEY, on ? 'on' : 'off');
  if (!on) {
    const tester = await data.attendees.findByStaffNo(TEST_STAFF_NO);
    if (tester) await data.attendees.remove(tester.id);
    (await cookies()).delete(TEST_CLOCK_COOKIE);
  }
  await recordActivity(on ? 'Turned test mode on' : 'Turned test mode off', auth.session.operator);
  revalidatePath('/', 'layout');
  redirect('/admin/admins?testmode=' + (on ? 'on' : 'off') + '#test-mode');
}
