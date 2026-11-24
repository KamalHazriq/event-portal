/**
 * Everything a /screen page does, in one place, so /screen and
 * /screen/<view> cannot drift apart.
 */
import { pageNowParam } from '@/lib/test-clock-server';
import { notFound } from 'next/navigation';
import { after } from 'next/server';

import { requireAdmin } from '@/lib/admin-guard';
import { getEventConfig } from '@/lib/config';
import { resolveEventNow } from '@/lib/time';
import { runFeedbackNudges } from '@/modules/announce/nudges';
import { dispatchDueReminders } from '@/modules/reminders/dispatch';
import { readNowParam } from '@/modules/schedule/logic';

import { ScreenFrame } from './components/ScreenFrame';
import { loadScreenReactions, loadScreenView, readScreenSettings } from './load';
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
    overrideParam: await pageNowParam(readNowParam(options.nowParam)),
  });
  // Automatic feedback reminders ride on the projector's regular refresh.
  after(() => runFeedbackNudges(now).catch(() => 0));
  // And the scheduled reminders, in case the scheduler is not set up.
  after(() => dispatchDueReminders().catch(() => 0));
  const settings = await readScreenSettings();
  // Announcements stay on phones: the projector is left as a calm screen.
  const [payload, reactions] = await Promise.all([
    loadScreenView(options.view ?? settings.view, now, settings),
    loadScreenReactions(),
  ]);

  return (
    <ScreenFrame
      payload={payload}
      reactions={reactions}
      calm={settings.calm}
      shortName={config.event.shortName}
      orgLogo={
        config.branding.organisationLogoPath
          ? {
              src: config.branding.organisationLogoPath,
              alt: config.branding.organisationName || 'Organiser logo',
            }
          : null
      }
      clock={clockFromMinutes(now.minutes)}
      testMode={now.isOverride}
    />
  );
}
