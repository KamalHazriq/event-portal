import type { Metadata } from 'next';

import { getData } from '@/data';
import { requireAdmin } from '@/lib/admin-guard';
import { getEventConfig } from '@/lib/config';
import { resolveEventNow } from '@/lib/time';
import { resolveCheckInDay } from '@/modules/check-in/logic';
import { LuckyDrawPreview } from '@/modules/previews/components/LuckyDrawPreview';
import { PreviewBanner } from '@/modules/previews/components/PreviewBanner';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Lucky draw' };

export default async function LuckyDrawPage() {
  await requireAdmin('/admin/lucky-draw');

  const config = getEventConfig();
  const now = resolveEventNow({ timezone: config.event.timezone });
  const day = resolveCheckInDay(config.days, now);
  const data = getData();

  // Checked in people only, as the brief says. Reading the list is safe:
  // nothing is written, and no winner is stored.
  const checkedIn = day ? await data.checkIns.listByDay(day.id) : [];
  const usingEveryone = checkedIn.length === 0;
  const people = usingEveryone ? await data.attendees.list() : checkedIn.map((c) => c.attendee);

  const pool = people.map((p) => ({ id: p.id, name: p.name, department: p.department }));
  const defaultExcludedIds = people.filter((p) => p.isSecretariat).map((p) => p.id);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-ink">Lucky draw</h1>
        <p className="mt-1 text-ink-soft">
          Draws from people checked in {day ? `on ${day.label}` : 'today'}. Nobody can win twice.
        </p>
      </header>

      <PreviewBanner module="Extra, lucky draw">
        {usingEveryone
          ? 'Nobody is checked in yet, so the hat holds the whole attendee list for now. Run npm run demo:seed to see it with arrivals.'
          : `${pool.length} people checked in. Winners are not saved and do not reach the big screen yet.`}
      </PreviewBanner>

      {pool.length === 0 ? (
        <p className="rounded-lg border border-line bg-surface p-4 text-ink-soft">
          The attendee list is empty. Run npm run db:seed first.
        </p>
      ) : (
        <LuckyDrawPreview pool={pool} defaultExcludedIds={defaultExcludedIds} />
      )}
    </div>
  );
}
