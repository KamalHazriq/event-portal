import { cookies } from 'next/headers';
import { Suspense } from 'react';

import { getData } from '@/data';
import { ADMIN_COOKIE, readSessionValue } from '@/lib/admin-session';
import { getEventConfig } from '@/lib/config';
import { currentPlayer } from '@/modules/points/server';

import { ASK_FIRST_KEY, GUEST_COOKIE } from '../logic';
import { NameGateRedirect } from './NameGateRedirect';

/** On attendee pages: asks a device who it is, once, unless it is switched off. */
export async function NameGate() {
  const config = getEventConfig();
  if (!config.features.askNameFirst || !config.features.leaderboard) return null;
  const jar = await cookies();
  // The backup for someone not on the list: asked once, not on every page.
  if (jar.has(GUEST_COOKIE)) return null;
  // The secretariat browsing as attendees are never asked.
  if (readSessionValue(jar.get(ADMIN_COOKIE)?.value)) return null;
  // If the database cannot be reached, never block the page over a name.
  try {
    if ((await getData().settings.get(ASK_FIRST_KEY)) === 'off') return null;
    if (await currentPlayer()) return null;
  } catch {
    return null;
  }
  return (
    <Suspense fallback={null}>
      <NameGateRedirect />
    </Suspense>
  );
}
