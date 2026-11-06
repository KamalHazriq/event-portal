import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getData } from '@/data';
import { requireAdmin } from '@/lib/admin-guard';
import { getEventConfig } from '@/lib/config';
import {
  anonymityLabel,
  findFeedbackForm,
  formatAverage,
  formIdFromSlug,
  ratingBarWidths,
  tallyBestSessions,
} from '@/modules/feedback/logic';
import { readFormSettings } from '@/modules/feedback/settings';

export const dynamic = 'force-dynamic';

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const form = findFeedbackForm(getEventConfig(), formIdFromSlug(slug));
  return { title: form ? `Feedback: ${form.title}` : 'Feedback' };
}

/** "14:32 on Tue 15 Dec", in the event's own time zone. */
function when(iso: string, timezone: string): string {
  const parsed = new Date(iso);
  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(parsed);
  const date = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
    .formatToParts(parsed)
    .map((part) => (part.type === 'literal' ? part.value.replace(/,/g, '') : part.value))
    .join('');
  return `${time} on ${date}`;
}

export default async function FeedbackDetailPage({ params }: PageProps) {
  await requireAdmin('/admin/feedback');

  const { slug } = await params;
  const config = getEventConfig();
  const form = findFeedbackForm(config, formIdFromSlug(slug));
  if (!form) notFound();

  const data = getData();
  const [entries, summary, settings] = await Promise.all([
    data.feedback.listByForm(form.id),
    data.feedback.summary(form.id),
    readFormSettings(form.id),
  ]);

  const widths = ratingBarWidths(summary.ratingCounts);
  const sessionTitles = new Map(
    config.days.flatMap((day) => day.sessions.map((session) => [session.id, session.title])),
  );
  const best = form.kind === 'event' ? tallyBestSessions(entries) : [];
  const newestFirst = [...entries].reverse();

  return (
    <div className="space-y-5">
      <nav>
        <Link href="/admin/feedback" className="text-sm font-semibold text-primary">
          Back to all feedback
        </Link>
      </nav>

      <header>
        <h1 className="text-2xl font-bold leading-tight text-ink">{form.title}</h1>
        <p className="mt-1 text-ink-soft">{form.context}</p>
        <p className="mt-1 text-sm text-ink-soft">
          {anonymityLabel(settings.anonymity)}
          {settings.open ? '' : ', closed to new answers'}
        </p>
      </header>

      <section className="rounded-xl border border-line bg-surface p-4">
        <p className="text-4xl font-bold tabular-nums leading-none text-ink">{summary.responses}</p>
        <p className="mt-1 text-ink-soft">
          {summary.responses === 1 ? 'answer' : 'answers'}, averaging{' '}
          {formatAverage(summary.averageRating)}
        </p>

        <ul className="mt-4 space-y-1.5">
          {([5, 4, 3, 2, 1] as const).map((star) => (
            <li key={star} className="flex items-center gap-2">
              <span className="w-12 shrink-0 text-sm tabular-nums text-ink-soft">
                {star} star{star === 1 ? '' : 's'}
              </span>
              <span className="h-3 flex-1 overflow-hidden rounded-full bg-muted">
                <span
                  className="block h-full rounded-full bg-primary"
                  style={{ width: `${widths[star]}%` }}
                />
              </span>
              <span className="w-8 shrink-0 text-right text-sm tabular-nums text-ink">
                {summary.ratingCounts[star]}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {best.length > 0 ? (
        <section>
          <h2 className="mb-2 text-lg font-bold text-ink">Most useful session</h2>
          <ul className="space-y-1">
            {best.map((row) => (
              <li
                key={row.sessionId}
                className="flex items-baseline justify-between gap-3 rounded border border-line bg-surface px-3 py-2"
              >
                <span className="text-ink">
                  {sessionTitles.get(row.sessionId) ?? row.sessionId}
                </span>
                <span className="shrink-0 font-bold tabular-nums text-ink">{row.votes}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <h2 className="mb-2 text-lg font-bold text-ink">What people wrote</h2>

        {newestFirst.length === 0 ? (
          <p className="rounded-lg border border-line bg-surface p-4 text-ink-soft">
            No answers yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {newestFirst.map((entry) => {
              const hasText = entry.answers.comment || entry.answers.improve;
              return (
                <li key={entry.id} className="rounded-lg border border-line bg-surface p-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-bold text-ink">
                      {entry.rating !== null ? `${entry.rating} / 5` : 'No rating'}
                      {entry.displayName ? (
                        <span className="ml-2 font-normal text-ink-soft">{entry.displayName}</span>
                      ) : (
                        <span className="ml-2 font-normal italic text-ink-soft">Anonymous</span>
                      )}
                    </span>
                    <span className="shrink-0 text-xs text-ink-soft">
                      {when(entry.at, config.event.timezone)}
                    </span>
                  </div>

                  {entry.answers.improve ? (
                    <p className="mt-2 whitespace-pre-line text-ink">
                      <span className="font-semibold">To improve: </span>
                      {entry.answers.improve}
                    </p>
                  ) : null}

                  {entry.answers.comment ? (
                    <p className="mt-1 whitespace-pre-line text-ink">{entry.answers.comment}</p>
                  ) : null}

                  {!hasText ? (
                    <p className="mt-1 text-sm italic text-ink-soft">Rating only, no comment.</p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
