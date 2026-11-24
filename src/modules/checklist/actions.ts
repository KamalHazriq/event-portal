'use server';

import { removeAllClaims } from '@/modules/door-gift/server';
import { forgetImages } from '@/modules/photos/image-cache';
import { PICKER_KEY } from '@/modules/name-picker/logic';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { getData } from '@/data';
import { requireAdminApi } from '@/lib/admin-guard';
import { recordActivity } from '@/modules/admins/record';

import { TEST_PARTICIPANT, TEST_STAFF_NO } from './test-participant';

/**
 * Wipes what people did while testing (check ins, comments, reactions,
 * photos, feedback, lucky draw winners, votes, questions, phone sign ins),
 * and keeps what was set up (the participant list, the agenda edits, the
 * settings and the polls). Needs the PIN session and the word CLEAR.
 */
export async function clearTestData(formData: FormData): Promise<void> {
  const auth = await requireAdminApi();
  if (!auth.ok) throw new Error('Not signed in.');
  if (
    String(formData.get('confirm') ?? '')
      .trim()
      .toUpperCase() !== 'CLEAR'
  ) {
    redirect('/admin/test-plan?error=confirm#clean');
  }
  await getData().clearActivity();
  // Door gift spins and name picker turns live in settings: they go too.
  await removeAllClaims();
  forgetImages();
  await getData().settings.remove(PICKER_KEY);
  await recordActivity(
    'Cleared all test data (activity only; the list and settings kept)',
    auth.session.operator,
  );
  revalidatePath('/', 'layout');
  redirect('/admin/test-plan?cleared=1#clean');
}

/** Puts "Test Participant" on the list, to test as an attendee. */
export async function addTestParticipant(): Promise<void> {
  const auth = await requireAdminApi();
  if (!auth.ok) throw new Error('Not signed in.');
  await getData().attendees.importRows([TEST_PARTICIPANT]);
  await recordActivity('Added the test participant', auth.session.operator);
  revalidatePath('/admin/test-plan');
  redirect('/admin/test-plan?tester=added#tester');
}

/** Takes "Test Participant" off the list again, with their check ins and phone links. */
export async function removeTestParticipant(): Promise<void> {
  const auth = await requireAdminApi();
  if (!auth.ok) throw new Error('Not signed in.');
  const data = getData();
  const tester = await data.attendees.findByStaffNo(TEST_STAFF_NO);
  if (tester) await data.attendees.remove(tester.id);
  await recordActivity('Removed the test participant', auth.session.operator);
  revalidatePath('/', 'layout');
  redirect('/admin/test-plan?tester=removed#tester');
}
