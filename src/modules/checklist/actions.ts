'use server';

import { cookies, headers } from 'next/headers';
import { TEST_CLOCK_COOKIE, TEST_CLOCK_HOURS, testClockValue } from '@/lib/test-clock';
import { timeOverrideAllowed } from '@/lib/time';

import { removeAllClaims } from '@/modules/door-gift/server';
import { forgetImages } from '@/modules/photos/image-cache';
import { PICKER_KEY } from '@/modules/name-picker/logic';
import { BONUS_KEY } from '@/modules/points/logic';
import { ANNOUNCE_KEYS } from '@/modules/announce/logic';
import { REMINDERS_KEY } from '@/modules/reminders/logic';

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
  await getData().settings.remove(BONUS_KEY);
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

/**
 * Clears everything people did, except the photos, and keeps the participant
 * list and every setting. For a fresh start once testing is over: check ins,
 * points, comments, reactions, feedback, the lucky draw, Q&A and poll votes,
 * phone sign ins, door gift spins, name picker turns, announcements and
 * scheduled messages all go. Needs the PIN session and the word CLEAR.
 */
export async function clearAllButPhotos(formData: FormData): Promise<void> {
  const auth = await requireAdminApi();
  if (!auth.ok) throw new Error('Not signed in.');
  if (
    String(formData.get('confirm') ?? '')
      .trim()
      .toUpperCase() !== 'CLEAR'
  ) {
    redirect(`${safeBack(formData)}?cleared=confirm#clear-all`);
  }
  const data = getData();
  await data.clearActivity({ keepPhotos: true });
  await removeAllClaims();
  await Promise.all(
    [PICKER_KEY, BONUS_KEY, ANNOUNCE_KEYS.current, ANNOUNCE_KEYS.history, REMINDERS_KEY].map(
      (key) => data.settings.remove(key),
    ),
  );
  await recordActivity(
    'Cleared everything except the photos and the participant list',
    auth.session.operator,
  );
  revalidatePath('/', 'layout');
  redirect(`${safeBack(formData)}?cleared=all#clear-all`);
}

/** Saves a moment on this device, so every attendee page on it pretends it is then. */
export async function setTestClock(formData: FormData): Promise<void> {
  const auth = await requireAdminApi();
  if (!auth.ok) throw new Error('Not signed in.');
  const value = testClockValue(String(formData.get('moment') ?? ''));
  if (!value || !timeOverrideAllowed()) redirect('/admin/test-plan?clock=off#test-clock');
  (await cookies()).set(TEST_CLOCK_COOKIE, value, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: TEST_CLOCK_HOURS * 3600,
  });
  redirect('/admin/test-plan?clock=on#test-clock');
}

/** Back to the real time on this device. Open to anyone: it only clears their own clock. */
export async function clearTestClock(formData: FormData): Promise<void> {
  (await cookies()).delete(TEST_CLOCK_COOKIE);
  const back = String(formData.get('back') ?? '');
  if (back === 'here') {
    const from = (await headers()).get('referer') ?? '';
    const path = (() => {
      try {
        return new URL(from).pathname;
      } catch {
        return '';
      }
    })();
    redirect(path.startsWith('/admin') ? path : '/admin');
  }
  redirect(back === 'plan' ? '/admin/test-plan?clock=cleared#test-clock' : '/');
}

/** Where "Clear everything except photos" came from: only a secretariat page. */
function safeBack(formData: FormData): string {
  const back = String(formData.get('back') ?? '');
  return ['/admin/admins', '/admin/test-plan', '/admin/photos'].includes(back)
    ? back
    : '/admin/admins';
}
