/**
 * Everything a /screen page does, in one place, so /screen and
 * /screen/<view> cannot drift apart.
 */
import { notFound } from 'next/navigation';

import { requireAdmin } from '@/lib/admin-guard';
import { getEventConfig } from '@/lib/config';
import { resolveEventNow } from '@/lib/time';
import { readNowParam } from '@/modules/schedule/logic';

import { ScreenFrame } from './components/ScreenFrame';
import { loadScreenView, readScreenSettings } from './load';
import { clockFromMinutes, type ScreenView } from './logic';

export async function renderScreen(options: {
  /** A fixed view, or null to follow whatever the MC picked. */
  view: ScreenView | null;
  returnTo: string;
  nowParam: string | string[] | undefined;
}) {
  // The projector laptop signs in once like any other desk, for example as
  // "screen". The arrivals view shows names, so this is not public.
  await requireAdmin(options.returnTo);

  const config = getEventConfig();

  // Switched off in config means the pages do not exist, as for every module.
  if (!config.features.bigScreen) notFound();

  const now = resolveEventNow({
    timezone: config.event.timezone,
    overrideParam: readNowParam(options.nowParam),
  });
  const settings = await readScreenSettings();
  const payload = await loadScreenView(options.view ?? settings.view, now, settings);

  return (
    <ScreenFrame
      payload={payload}
      shortName={config.event.shortName}
      clock={clockFromMinutes(now.minutes)}
      testMode={now.isOverride}
    />
  );
}
