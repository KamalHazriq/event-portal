'use server';

import { revalidatePath } from 'next/cache';

import { getData } from '@/data';
import { requireAdminApi } from '@/lib/admin-guard';
import { getEventConfig } from '@/lib/config';
import { plainText } from '@/lib/text';
import { resolveEventNow } from '@/lib/time';

import {
  countdownTargetFromNow,
  isLocalDateTime,
  MAX_SURPRISE_LABEL,
  SURPRISE_KEYS,
} from './logic';
import { recordActivity } from '@/modules/admins/record';

/**
 * The countdown control used during the event.
 *
 * Every one of these checks the session itself. Being rendered on an admin
 * page is not a check: the docs are explicit that a Server Action is a public
 * endpoint whatever renders the form.
 */

async function assertAdmin(): Promise<void> {
  const auth = await requireAdminApi();
  if (!auth.ok) throw new Error('Not signed in.');
}

export async function updateCountdown(formData: FormData): Promise<void> {
  await assertAdmin();

  const data = getData();
  const intent = String(formData.get('intent') ?? '');

  if (intent === 'off') {
    await data.settings.set(SURPRISE_KEYS.enabled, 'false');
    await recordActivity('Switched the countdown off');
    revalidatePath('/admin/live');
    return;
  }

  // Back to whatever config/event.json says, as if nobody had touched it.
  if (intent === 'reset') {
    await Promise.all([
      data.settings.remove(SURPRISE_KEYS.enabled),
      data.settings.remove(SURPRISE_KEYS.targetAt),
      data.settings.remove(SURPRISE_KEYS.label),
    ]);
    await recordActivity('Reset the countdown to the config file');
    revalidatePath('/admin/live');
    return;
  }

  let targetAt: string | null = null;

  if (intent === 'quick') {
    const minutes = Number(formData.get('minutes'));
    if (!Number.isFinite(minutes) || minutes < 1 || minutes > 24 * 60) {
      throw new Error('That is not a number of minutes.');
    }
    const config = getEventConfig();
    const now = resolveEventNow({ timezone: config.event.timezone });
    targetAt = countdownTargetFromNow(now, Math.round(minutes));
  } else if (intent === 'exact') {
    const raw = String(formData.get('targetAt') ?? '').trim();
    if (!isLocalDateTime(raw)) {
      throw new Error('That is not a date and time, for example 2026-12-15T20:30.');
    }
    targetAt = raw;
  } else {
    throw new Error('Unknown countdown action.');
  }

  await Promise.all([
    data.settings.set(SURPRISE_KEYS.targetAt, targetAt),
    data.settings.set(SURPRISE_KEYS.enabled, 'true'),
  ]);
  await recordActivity('Started the countdown');

  revalidatePath('/admin/live');
}

export async function updateCountdownLabel(formData: FormData): Promise<void> {
  await assertAdmin();

  const label = plainText(formData.get('label'), MAX_SURPRISE_LABEL);
  const data = getData();

  if (label.length === 0) await data.settings.remove(SURPRISE_KEYS.label);
  else await data.settings.set(SURPRISE_KEYS.label, label);
  await recordActivity('Changed the countdown label');

  revalidatePath('/admin/live');
}
