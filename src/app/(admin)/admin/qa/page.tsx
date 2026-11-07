import type { Metadata } from 'next';

import { requireAdmin } from '@/lib/admin-guard';
import { getEventConfig } from '@/lib/config';
import { PreviewBanner } from '@/modules/previews/components/PreviewBanner';
import { QaPreview } from '@/modules/previews/components/QaPreview';
import { mockQuestions } from '@/modules/previews/mock-data';
import { buildAgenda } from '@/modules/schedule/logic';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Q&A queue' };

export default async function QaQueuePage() {
  await requireAdmin('/admin/qa');

  const agenda = buildAgenda(getEventConfig());
  const qaSessions = agenda.sessions.filter((s) => s.qaEnabled);
  const questions = mockQuestions(agenda.sessions);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-ink">Q&A queue</h1>
        <p className="mt-1 text-ink-soft">
          Questions stay hidden until someone approves them. Only approved questions reach phones
          and the big screen, highest votes first, with any pinned question on top.
        </p>
      </header>

      <PreviewBanner module="Module 2, backup Q&A">
        Q&A runs on Slido for this event. This is the fallback if Slido is unavailable on the day.
        The questions and names are invented.
      </PreviewBanner>

      {qaSessions.length === 0 ? (
        <p className="rounded-lg border border-line bg-surface p-4 text-ink-soft">
          No session has qaEnabled set in config/event.json.
        </p>
      ) : (
        <QaPreview
          questions={questions}
          sessions={qaSessions.map((s) => ({ id: s.id, title: `${s.dayLabel}: ${s.title}` }))}
        />
      )}
    </div>
  );
}
