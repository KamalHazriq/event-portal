'use server';

import { randomInt } from 'node:crypto';

import { revalidatePath } from 'next/cache';

import { getData } from '@/data';
import { requireAdminApi } from '@/lib/admin-guard';
import { getEventConfig } from '@/lib/config';
import { newId } from '@/lib/ids';
import { LIMITS, rateLimit } from '@/lib/rate-limit';
import { plainText } from '@/lib/text';
import { resolveEventNow } from '@/lib/time';
import { SCREEN_KEYS } from '@/modules/big-screen/logic';
import { resolveCheckInDay } from '@/modules/check-in/logic';

import {
  drawWinners,
  LUCKY_KEYS,
  MAX_PRIZE,
  parseDrawCount,
  resolveExclusions,
  type DrawEntrant,
} from './logic';

/**
 * The lucky draw buttons. Each checks the session itself: a Server Action is
 * a public endpoint whatever page renders the form.
 *
 * The draw happens here on the server, with the operating system's secure
 * random numbers, so it is fair, and two desks can never see different
 * results.
 */

async function assertAdmin(): Promise<string> {
  const auth = await requireAdminApi();
  if (!auth.ok) throw new Error('Not signed in.');
  if (!getEventConfig().features.luckyDraw) throw new Error('The lucky draw is switched off.');
  return auth.session.operator;
}

/** 0 to 1, from crypto, in the shape drawWinners expects. */
const secureRandom = () => randomInt(0, 2 ** 32) / 2 ** 32;

function done(): void {
  revalidatePath('/admin/lucky-draw');
  revalidatePath('/admin/big-screen');
}

export async function drawLucky(formData: FormData): Promise<void> {
  const operator = await assertAdmin();
  if (!rateLimit(`draw:${operator}`, LIMITS.luckyDraw).allowed) {
    throw new Error('Too many draws in a row. Wait a moment.');
  }

  const count = parseDrawCount(formData.get('count'));
  const prize = plainText(formData.get('prize'), MAX_PRIZE);
  const showOnScreen = formData.get('showOnScreen') === 'on';

  const config = getEventConfig();
  const day = resolveCheckInDay(config.days, resolveEventNow({ timezone: config.event.timezone }));
  if (!day) return;

  const data = getData();

  // Two attempts: if another desk drew one of our picks in the same instant,
  // the store refuses the whole draw and we draw again from a fresh pool.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const [checkedIn, everyone, winners, stored] = await Promise.all([
      data.checkIns.listByDay(day.id),
      data.attendees.list(),
      data.luckyDraw.list(),
      data.settings.get(LUCKY_KEYS.excluded),
    ]);

    const pool: DrawEntrant[] = checkedIn.map((c) => ({
      id: c.attendee.id,
      name: c.attendee.name,
      department: c.attendee.department,
    }));
    const picked = drawWinners(
      pool,
      resolveExclusions(stored, everyone),
      new Set(winners.map((w) => w.attendeeId)),
      count,
      secureRandom,
    );
    if (picked.length === 0) return;

    const result = await data.luckyDraw.record({
      drawId: newId(),
      prize,
      byOperator: operator,
      attendeeIds: picked.map((p) => p.id),
    });
    if (result.ok) {
      if (showOnScreen) await data.settings.set(SCREEN_KEYS.view, 'lucky-draw');
      done();
      return;
    }
  }

  throw new Error('Another desk drew at the same moment. Press Draw again.');
}

/** Someone who was not in the room: off the list and out of the hat. */
export async function removeWinner(formData: FormData): Promise<void> {
  await assertAdmin();
  const winnerId = plainText(formData.get('winnerId'), 64);
  const attendeeId = plainText(formData.get('attendeeId'), 64);
  const data = getData();

  await data.luckyDraw.remove(winnerId);

  if (formData.get('exclude') === 'yes' && attendeeId) {
    const [stored, everyone] = await Promise.all([
      data.settings.get(LUCKY_KEYS.excluded),
      data.attendees.list(),
    ]);
    const excluded = resolveExclusions(stored, everyone);
    excluded.add(attendeeId);
    await data.settings.set(LUCKY_KEYS.excluded, JSON.stringify([...excluded]));
  }
  done();
}

/** Saves the ticked list. A ticked box means "in the hat". */
export async function saveExclusions(formData: FormData): Promise<void> {
  await assertAdmin();
  const data = getData();
  const everyone = await data.attendees.list();
  const included = new Set(formData.getAll('include').map((v) => String(v)));
  const excluded = everyone.filter((p) => !included.has(p.id)).map((p) => p.id);
  await data.settings.set(LUCKY_KEYS.excluded, JSON.stringify(excluded));
  done();
}

/** For rehearsals: clears every winner, keeps the exclusions. */
export async function clearWinners(formData: FormData): Promise<void> {
  await assertAdmin();
  if (formData.get('confirm') !== 'yes') return;
  await getData().luckyDraw.clear();
  done();
}
