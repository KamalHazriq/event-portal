'use server';

import { revalidatePath } from 'next/cache';

import { getData } from '@/data';
import { requireAdminApi } from '@/lib/admin-guard';

import { loadScoreboard } from '@/modules/points/server';
import {
  isScreenView,
  parsePodiumSize,
  podiumGroups,
  SCREEN_KEYS,
  SCREEN_VIEW_INFO,
} from './logic';
import { recordActivity } from '@/modules/admins/record';
import { getEventConfig } from '@/lib/config';
import { QA_KEYS } from '@/modules/qa/logic';
import { COMMENT_KEYS } from '@/modules/talk/logic';

/**
 * The big screen switches, used from /admin/big-screen.
 *
 * Each one checks the session itself: a Server Action is a public endpoint
 * whatever page renders the form.
 */

async function assertAdmin(): Promise<void> {
  const auth = await requireAdminApi();
  if (!auth.ok) throw new Error('Not signed in.');
}

export async function setScreenView(formData: FormData): Promise<void> {
  await assertAdmin();
  const view = String(formData.get('view') ?? '');
  if (!isScreenView(view)) throw new Error('That is not a big screen view.');
  await getData().settings.set(SCREEN_KEYS.view, view);
  // A podium always starts with nothing revealed.
  if (view === 'podium') await getData().settings.set(SCREEN_KEYS.podiumStep, '0');
  await recordActivity(`Put "${SCREEN_VIEW_INFO[view].title}" on the big screen`);
  revalidatePath('/admin/big-screen');
}

/** Calm mode on or off: no moving background and no hexagon wipe. */
export async function setScreenCalm(formData: FormData): Promise<void> {
  await assertAdmin();
  const calm = String(formData.get('calm') ?? '') === 'true';
  await getData().settings.set(SCREEN_KEYS.calm, calm ? 'true' : 'false');
  await recordActivity(
    calm ? 'Turned the big screen to calm mode' : 'Turned the big screen effects on',
  );
  revalidatePath('/admin/big-screen');
}

export async function setHideNames(formData: FormData): Promise<void> {
  await assertAdmin();
  const hide = String(formData.get('hideNames') ?? '') === 'true';
  await getData().settings.set(SCREEN_KEYS.hideNames, hide ? 'true' : 'false');
  await recordActivity(
    hide ? 'Hid names on the arrivals screen' : 'Showed names on the arrivals screen',
  );
  revalidatePath('/admin/big-screen');
}

/**
 * Which talk the projector's comments and questions are about. "auto" (or
 * nothing) follows the talk running now. Sets both views at once.
 */
export async function setScreenTalk(formData: FormData): Promise<void> {
  await assertAdmin();
  const data = getData();
  const raw = String(formData.get('session') ?? 'auto');
  const known = getEventConfig()
    .days.flatMap((d) => d.sessions)
    .some((s) => s.id === raw);
  if (known) {
    await data.settings.set(COMMENT_KEYS.screenSession, raw);
    await data.settings.set(QA_KEYS.screenSession, raw);
  } else {
    await data.settings.remove(COMMENT_KEYS.screenSession);
    await data.settings.remove(QA_KEYS.screenSession);
  }
  await recordActivity(
    known
      ? 'Chose the talk for the screen comments and questions'
      : 'Screen talk: follow the talk on now',
  );
  revalidatePath('/admin/big-screen');
  revalidatePath('/admin/comments');
}

/**
 * The podium reveal. "size" picks top 3, 5 or 10 and starts again from the
 * bottom; "next" reveals one more place; "all" shows everything; "reset"
 * hides it again. The screen clamps the step to the places that exist.
 */
export async function podiumControl(formData: FormData): Promise<void> {
  await assertAdmin();
  const data = getData();
  const action = String(formData.get('action') ?? '');
  const current = Number((await data.settings.get(SCREEN_KEYS.podiumStep)) ?? 0) || 0;

  if (action === 'size') {
    const size = parsePodiumSize(formData.get('size'));
    await data.settings.set(SCREEN_KEYS.podiumSize, String(size));
    await data.settings.set(SCREEN_KEYS.podiumStep, '0');
    await recordActivity(`Podium: top ${size}`);
  } else if (action === 'next') {
    await data.settings.set(SCREEN_KEYS.podiumStep, String(current + 1));
  } else if (action === 'back') {
    await data.settings.set(SCREEN_KEYS.podiumStep, String(Math.max(0, current - 1)));
  } else if (action === 'rest') {
    // Everyone below the top three at once: places 4 and down.
    const size = parsePodiumSize(await data.settings.get(SCREEN_KEYS.podiumSize));
    const groups = podiumGroups((await loadScoreboard({ shared: true })).people, size);
    const below = groups.filter((g) => g.rank > 3).length;
    await data.settings.set(SCREEN_KEYS.podiumStep, String(Math.max(current, below)));
  } else if (action === 'all') {
    await data.settings.set(SCREEN_KEYS.podiumStep, '99');
  } else if (action === 'reset') {
    await data.settings.set(SCREEN_KEYS.podiumStep, '0');
  }
  await data.settings.set(SCREEN_KEYS.view, 'podium');
  revalidatePath('/admin/big-screen');
}

/** What the Feedback QR on the projector is for: auto, the whole event, or one session. */
export async function setFeedbackTarget(formData: FormData): Promise<void> {
  await assertAdmin();
  const raw = String(formData.get('target') ?? 'auto');
  const known =
    raw === 'auto' ||
    raw === 'event' ||
    getEventConfig()
      .days.flatMap((d) => d.sessions)
      .some((s) => s.id === raw && s.feedbackEnabled);
  await getData().settings.set(SCREEN_KEYS.feedbackTarget, known ? raw : 'auto');
  await getData().settings.set(SCREEN_KEYS.view, 'feedback');
  await recordActivity('Put the feedback QR on the big screen');
  revalidatePath('/admin/big-screen');
}
