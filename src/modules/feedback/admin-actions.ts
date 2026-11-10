'use server';

import { revalidatePath } from 'next/cache';

import { requireAdminApi } from '@/lib/admin-guard';
import { getEventConfig } from '@/lib/config';

import { findFeedbackForm, isAnonymityMode } from './logic';
import { setEventAnonymityDefault, setFormAnonymity, setFormOpen } from './settings';
import { recordActivity } from '@/modules/admins/record';

/**
 * The admin controls for feedback.
 *
 * Every one of these checks the session itself. The docs are explicit that an
 * action is a public endpoint whatever page renders the control, so being
 * rendered on an admin page is not a check.
 */

async function assertAdmin(): Promise<void> {
  const auth = await requireAdminApi();
  if (!auth.ok) throw new Error('Not signed in.');
}

/** The rule every form follows unless it has its own setting. */
export async function updateDefaultAnonymity(formData: FormData): Promise<void> {
  await assertAdmin();

  const mode = String(formData.get('mode') ?? '');
  if (!isAnonymityMode(mode)) throw new Error('That is not an anonymity setting.');

  await setEventAnonymityDefault(mode);
  await recordActivity('Changed the default name setting for feedback');
  revalidatePath('/admin/feedback');
}

/** One form's own setting. The value "default" clears it. */
export async function updateFormAnonymity(formData: FormData): Promise<void> {
  await assertAdmin();

  const formId = String(formData.get('formId') ?? '');
  if (!findFeedbackForm(getEventConfig(), formId)) throw new Error('No such form.');

  const raw = String(formData.get('mode') ?? '');
  if (raw === 'default') {
    await setFormAnonymity(formId, null);
  } else if (isAnonymityMode(raw)) {
    await setFormAnonymity(formId, raw);
  } else {
    throw new Error('That is not an anonymity setting.');
  }

  await recordActivity("Changed a feedback form's name setting");
  revalidatePath('/admin/feedback');
}

/** Opens or closes one form. */
export async function updateFormOpen(formData: FormData): Promise<void> {
  await assertAdmin();

  const formId = String(formData.get('formId') ?? '');
  if (!findFeedbackForm(getEventConfig(), formId)) throw new Error('No such form.');

  const open = String(formData.get('open') ?? '') === 'open';
  await setFormOpen(formId, open);
  await recordActivity(open ? 'Opened a feedback form' : 'Closed a feedback form');
  revalidatePath('/admin/feedback');
}
