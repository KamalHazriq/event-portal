'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { getData } from '@/data';
import { requireAdminApi } from '@/lib/admin-guard';
import { TEST_CLOCK_COOKIE, TEST_CLOCK_HOURS, testClockValue } from '@/lib/test-clock';
import { timeOverrideAllowed } from '@/lib/time';
import { recordActivity } from '@/modules/admins/record';
import { TEST_PARTICIPANT } from '@/modules/checklist/test-participant';

/** The one click setup buttons on /admin/tour. Each checks the session itself. */

async function assertAdmin(): Promise<string> {
  const auth = await requireAdminApi();
  if (!auth.ok) throw new Error('Not signed in.');
  return auth.session.operator;
}

/** Puts "Test Participant" on the list, so there is someone to demo as. */
export async function tourAddTester(): Promise<void> {
  const operator = await assertAdmin();
  await getData().attendees.importRows([TEST_PARTICIPANT]);
  await recordActivity('Added the test participant (tour)', operator);
  revalidatePath('/admin/tour');
  redirect('/admin/tour#get-ready');
}

/** Pretends it is this moment on this device. */
export async function tourSetClock(formData: FormData): Promise<void> {
  await assertAdmin();
  const value = testClockValue(String(formData.get('moment') ?? ''));
  if (value && timeOverrideAllowed()) {
    (await cookies()).set(TEST_CLOCK_COOKIE, value, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: TEST_CLOCK_HOURS * 3600,
    });
  }
  redirect('/admin/tour#get-ready');
}

/** Back to the real time on this device. */
export async function tourClockOff(): Promise<void> {
  await assertAdmin();
  (await cookies()).delete(TEST_CLOCK_COOKIE);
  redirect('/admin/tour#get-ready');
}
