'use server';

import { revalidatePath } from 'next/cache';

import { getData } from '@/data';
import { requireAdminApi } from '@/lib/admin-guard';
import { getEventConfig } from '@/lib/config';
import { plainText } from '@/lib/text';
import { storeScheduleDelay } from '@/lib/schedule-delay';
import { parseDelay, scheduleDelayMinutes } from '@/lib/schedule-delay-state';
import { buildAgenda } from '@/modules/schedule/logic';
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

/** "We are running N minutes late": the whole portal's now follows. 0 is on time. */
export async function setScheduleDelay(formData: FormData): Promise<void> {
  await assertAdmin();
  const minutes = parseDelay(String(formData.get('minutes') ?? '0'));
  await storeScheduleDelay(minutes);
  await recordActivity(
    minutes ? `Set the agenda running ${minutes} minutes late` : 'Set the agenda back on time',
  );
  revalidatePath('/admin/live');
  revalidatePath('/admin/big-screen');
  revalidatePath('/', 'layout');
}

/**
 * "Move the agenda to the room", instead of waiting for the clock.
 * kind "start": this session starts now (the one before it ends). kind "end":
 * this session ends now. kind "nudge": move by +N or -N minutes. kind "clock":
 * follow the real clock again. All of them work by changing how far the
 * portal's "now" is from the real time, so every page follows at once.
 */
export async function moveAgenda(formData: FormData): Promise<void> {
  await assertAdmin();
  const kind = String(formData.get('kind') ?? '');
  const config = getEventConfig();
  const real = resolveEventNow({ timezone: config.event.timezone, at: new Date() });
  const current = parseDelay(String(scheduleDelayMinutes()));
  let next = current;

  if (kind === 'clock') {
    next = 0;
  } else if (kind === 'nudge') {
    next = parseDelay(String(current + Number(formData.get('minutes') ?? 0)));
  } else if (kind === 'start' || kind === 'end') {
    const id = String(formData.get('sessionId') ?? '');
    const session = buildAgenda(config).byId.get(id);
    // Only on the session's own day: before that there is nothing to follow.
    if (session && session.date === real.date) {
      const target = kind === 'start' ? session.startMinutes : session.endMinutes;
      next = parseDelay(String(real.minutes - target));
    }
  }

  await storeScheduleDelay(next);
  await recordActivity(
    kind === 'clock'
      ? 'Set the agenda back to the clock'
      : kind === 'start'
        ? 'Started the next session now'
        : kind === 'end'
          ? 'Ended the session now'
          : `Moved the agenda ${Number(formData.get('minutes') ?? 0)} minutes`,
  );
  revalidatePath('/admin/live');
  revalidatePath('/admin/big-screen');
  revalidatePath('/', 'layout');
}

export async function updateCountdown(formData: FormData): Promise<void> {
  await assertAdmin();

  const data = getData();
  const intent = String(formData.get('intent') ?? '');

  if (intent === 'off') {
    await data.settings.set(SURPRISE_KEYS.enabled, 'false');
    await recordActivity('Switched the countdown off');
    revalidatePath('/admin/live');
    revalidatePath('/admin/big-screen');
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
    revalidatePath('/admin/big-screen');
    return;
  }

  let targetAt: string | null = null;

  if (intent === 'quick') {
    const minutes = Number(formData.get('minutes'));
    if (!Number.isFinite(minutes) || minutes < 1 || minutes > 24 * 60) {
      throw new Error('That is not a number of minutes.');
    }
    const config = getEventConfig();
    // The real clock, not the running late one: a countdown is to a real moment.
    const now = resolveEventNow({ timezone: config.event.timezone, at: new Date() });
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
  revalidatePath('/admin/big-screen');
}

export async function updateCountdownLabel(formData: FormData): Promise<void> {
  await assertAdmin();

  const label = plainText(formData.get('label'), MAX_SURPRISE_LABEL);
  const data = getData();

  if (label.length === 0) await data.settings.remove(SURPRISE_KEYS.label);
  else await data.settings.set(SURPRISE_KEYS.label, label);
  await recordActivity('Changed the countdown label');

  revalidatePath('/admin/live');
  revalidatePath('/admin/big-screen');
}
