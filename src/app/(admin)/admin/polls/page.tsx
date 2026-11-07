import type { Metadata } from 'next';

import { getData } from '@/data';
import { requireAdmin } from '@/lib/admin-guard';
import { PollsPreview } from '@/modules/previews/components/PollsPreview';
import { PreviewBanner } from '@/modules/previews/components/PreviewBanner';
import { mockPolls } from '@/modules/previews/mock-data';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Polls' };

export default async function PollsPage() {
  await requireAdmin('/admin/polls');

  // Size the invented votes to the real room, so the bars look right.
  const attendees = await getData().attendees.count();
  const polls = mockPolls(attendees > 0 ? attendees : 78);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-ink">Polls</h1>
        <p className="mt-1 text-ink-soft">
          Set polls up ahead of time, open one when the MC asks for it, and reveal the results on
          the big screen. One vote per phone.
        </p>
      </header>

      <PreviewBanner module="Module 3, backup polls">
        Polls run on Slido for this event. This is the fallback if Slido is unavailable on the day.
        The votes are invented.
      </PreviewBanner>

      <PollsPreview polls={polls} />
    </div>
  );
}
