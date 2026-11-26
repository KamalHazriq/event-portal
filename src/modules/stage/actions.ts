'use server';

import { revalidatePath } from 'next/cache';

import { getData } from '@/data';
import { requireAdminApi } from '@/lib/admin-guard';
import { getEventConfig } from '@/lib/config';
import { SCREEN_VIEW_INFO } from '@/modules/big-screen/logic';
import {
  availableScreenViews,
  DEFAULT_SCREEN_VIEW,
  isScreenView,
  SCREEN_KEYS,
} from '@/modules/big-screen/logic';
import { recordActivity } from '@/modules/admins/record';

import { cueNeighbours } from './cues';

/**
 * Next cue and Previous cue. Always a press: nothing here moves the screen by
 * itself. The agenda only suggests (see the cue bar on the stage console).
 */
export async function stepCue(formData: FormData): Promise<void> {
  const auth = await requireAdminApi();
  if (!auth.ok) throw new Error('Not signed in.');
  const data = getData();
  const available = availableScreenViews(getEventConfig().features);
  const stored = await data.settings.get(SCREEN_KEYS.view);
  const current = isScreenView(stored) ? stored : DEFAULT_SCREEN_VIEW;
  const { prev, next } = cueNeighbours(current, available);
  const target = formData.get('dir') === 'prev' ? prev : next;
  if (!target) return;
  await data.settings.set(SCREEN_KEYS.view, target);
  // A podium always starts with nothing revealed.
  if (target === 'podium') await data.settings.set(SCREEN_KEYS.podiumStep, '0');
  await recordActivity(
    `Put "${SCREEN_VIEW_INFO[target].title}" on the big screen`,
    auth.session.operator,
  );
  revalidatePath('/admin/big-screen');
}
