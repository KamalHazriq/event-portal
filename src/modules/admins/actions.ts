'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { getData } from '@/data';
import { ADMIN_COOKIE, GENERATION_KEY } from '@/lib/admin-session';
import { currentGeneration, requireAdminApi } from '@/lib/admin-guard';
import { recordActivity } from '@/modules/admins/record';

async function assertAdmin(): Promise<string> {
  const auth = await requireAdminApi();
  if (!auth.ok) throw new Error('Not signed in.');
  return auth.session.operator;
}

/**
 * Starts a new sign in round: every desk, this one included, has to enter
 * the PIN again. For a lost phone, or a clean start on the morning. The PIN
 * itself is not changed (to change it, update the portal-admin-pin secret).
 */
export async function signEveryoneOut(formData: FormData): Promise<void> {
  const operator = await assertAdmin();
  if (formData.get('confirm') !== 'yes') redirect('/admin/admins?error=confirm#resets');
  await recordActivity('Signed every desk out', operator);
  const next = (await currentGeneration()) + 1;
  await getData().settings.set(GENERATION_KEY, String(next));
  (await cookies()).delete(ADMIN_COOKIE);
  redirect('/admin/sign-in?out=all');
}

/**
 * Signs every attendee phone out of the leaderboard, so people pick their
 * name again. Points are worked out from what people did, so they come
 * back when a phone joins again.
 */
export async function resetLeaderboardSignIns(formData: FormData): Promise<void> {
  const operator = await assertAdmin();
  if (formData.get('confirm') !== 'yes') redirect('/admin/admins?error=confirm#resets');
  const count = await getData().players.unlinkAll();
  await recordActivity(`Reset the leaderboard sign ins (${count} phones)`, operator);
  revalidatePath('/', 'layout');
  redirect(`/admin/admins?reset=${count}#resets`);
}
