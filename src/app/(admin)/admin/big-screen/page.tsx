import type { Metadata } from 'next';

import { getData } from '@/data';
import { requireAdmin } from '@/lib/admin-guard';
import { getEventConfig } from '@/lib/config';
import { formatTimeRange, resolveEventNow } from '@/lib/time';
import { resolveSurprise, SURPRISE_KEYS } from '@/modules/admin/logic';
import { arrivalRate, resolveCheckInDay } from '@/modules/check-in/logic';
import { BigScreenPreview } from '@/modules/previews/components/BigScreenPreview';
import { PreviewBanner } from '@/modules/previews/components/PreviewBanner';
import { BIG_SCREEN_VIEWS, MOCK_NAMES } from '@/modules/previews/mock-data';
import { buildAgenda, findNowAndNext } from '@/modules/schedule/logic';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Big screen' };

export default async function BigScreenControlPage() {
  await requireAdmin('/admin/big-screen');

  const config = getEventConfig();
  const now = resolveEventNow({ timezone: config.event.timezone });
  const agenda = buildAgenda(config);
  const { live, next } = findNowAndNext(agenda, now);
  const day = resolveCheckInDay(config.days, now);

  const data = getData();
  const [headcount, enabled, targetAt, label] = await Promise.all([
    day ? data.checkIns.headcount(day.id) : Promise.resolve(null),
    data.settings.get(SURPRISE_KEYS.enabled),
    data.settings.get(SURPRISE_KEYS.targetAt),
    data.settings.get(SURPRISE_KEYS.label),
  ]);
  const rate = headcount ? arrivalRate(headcount.arrived, headcount.expected) : null;
  const surprise = resolveSurprise(config, { enabled, targetAt, label });
  const onNow = live[0] ?? next;

  // Real numbers where they exist already, invented ones where they do not.
  const samples: Record<string, { big: string; small: string }> = {
    welcome: { big: config.event.name, small: config.event.tagline || config.event.portalUrl },
    'now-next': {
      big: onNow?.title ?? 'Nothing scheduled',
      small: onNow ? formatTimeRange(onNow.start, onNow.end) : '',
    },
    arrivals: {
      big: `Welcome, ${MOCK_NAMES[3]}`,
      small: rate ? `${rate.arrived} / ${rate.expected} arrived` : '42 / 78 arrived',
    },
    countdown: { big: '14:59', small: surprise.label },
    'lucky-draw': { big: MOCK_NAMES[7], small: 'Winner 1 of 3' },
    photos: { big: 'Photo 4 of 23', small: 'Breakout group B' },
  };

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-ink">Big screen</h1>
        <p className="mt-1 text-ink-soft">
          Pick what the ballroom projector shows. The projector laptop opens one page and leaves it
          open, and this page switches it.
        </p>
      </header>

      <PreviewBanner module="Module 8, big screen mode">
        The welcome and now and next lines use the real agenda. The names are invented.
      </PreviewBanner>

      <BigScreenPreview
        views={BIG_SCREEN_VIEWS}
        samples={samples}
        palette={config.branding.themes[config.branding.bigScreenTheme]}
      />
    </div>
  );
}
