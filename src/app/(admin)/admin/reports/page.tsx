import type { Metadata } from 'next';
import Link from 'next/link';

import { getData } from '@/data';
import { requireAdmin } from '@/lib/admin-guard';
import { getEventConfig } from '@/lib/config';
import { slidoMessage } from '@/modules/reports/messages';
import { localDateTime } from '@/modules/reports/logic';
import { slidoHighlights } from '@/modules/reports/slido';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Reports' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const one = (v: string | string[] | undefined) => (typeof v === 'string' ? v : null);

const SHEETS = [
  ['Summary', 'The headline numbers on one page'],
  ['Attendance', 'Everyone on the list, with the time they arrived each day and how'],
  ['Attendance by department', 'Guests per department, per day'],
  ['Feedback', 'Every answer. Names only where the form allowed one and the person gave it'],
  ['Feedback by session', 'Answers, average stars and the spread of stars per session'],
  ['Best session votes', 'From the final event form'],
  ['Lucky draw', 'Every winner, in draw order, once the draw has been used'],
  ['Slido sheets', 'The polls and questions from the Slido export, once uploaded'],
] as const;

export default async function ReportsPage({ searchParams }: { searchParams: SearchParams }) {
  await requireAdmin('/admin/reports');
  const params = await searchParams;

  const config = getEventConfig();
  const imports = await getData().imports.list('slido');
  const highlights = slidoHighlights(imports);
  const message = slidoMessage(one(params.slido), one(params.kept), one(params.skipped));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-ink">Reports</h1>
        <p className="mt-1 text-ink-soft">
          The whole event in one Excel file, one sheet per topic, and a short summary to print or
          save as PDF. Both are built fresh each time, so they are always up to date.
        </p>
      </div>

      <section className="rounded-xl border border-line bg-surface p-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-ink-soft">Download</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {/* A plain link: the browser downloads the file, no JavaScript needed. */}
          <a
            href="/api/reports/excel"
            className="inline-flex min-h-11 items-center rounded-lg bg-primary px-4 font-bold text-on-primary no-underline"
          >
            Download Excel
          </a>
          <Link
            href="/admin/reports/summary"
            className="inline-flex min-h-11 items-center rounded-lg border border-line px-4 font-semibold text-ink no-underline"
          >
            Summary for PDF
          </Link>
        </div>
        <p className="mt-3 text-sm text-ink-soft">
          The Excel file holds names, so keep it on approved storage and do not forward it outside
          the secretariat.
        </p>

        <ul className="mt-3 divide-y divide-line">
          {SHEETS.map(([name, what]) => (
            <li key={name} className="flex flex-wrap justify-between gap-x-3 gap-y-0.5 py-2">
              <span className="font-semibold text-ink">{name}</span>
              <span className="text-sm text-ink-soft">{what}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-line bg-surface p-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-ink-soft">Slido results</h2>
        <p className="mt-1 text-sm text-ink">
          After the event, export the results from Slido as Excel and upload the file here. Its
          polls and questions are added to the report. Uploading again replaces the earlier file.
        </p>

        {message ? (
          <p
            role="status"
            className={[
              'mt-3 rounded-lg border p-3 text-sm font-semibold',
              message.tone === 'ok' ? 'border-success text-success' : 'border-warning text-warning',
            ].join(' ')}
          >
            {message.text}
          </p>
        ) : null}

        {imports.length > 0 ? (
          <div className="mt-3 rounded-lg bg-muted p-3 text-sm">
            <p className="font-semibold text-ink">
              In the report: {imports[0]?.fileName}, uploaded{' '}
              {localDateTime(imports[0]?.importedAt ?? '', config.event.timezone)} by{' '}
              <span className="font-mono">{imports[0]?.byOperator}</span>
            </p>
            <ul className="mt-1 text-ink-soft">
              {imports.map((sheet) => (
                <li key={sheet.id}>
                  {sheet.name}: {sheet.rows.length} rows of {sheet.kind}
                </li>
              ))}
            </ul>
            {highlights.topQuestions.length > 0 ? (
              <p className="mt-2 text-ink-soft">
                Most liked question: &ldquo;{highlights.topQuestions[0]?.text}&rdquo; (
                {highlights.topQuestions[0]?.likes})
              </p>
            ) : null}
          </div>
        ) : null}

        <form
          method="post"
          action="/api/reports/slido"
          encType="multipart/form-data"
          className="mt-3 space-y-2"
        >
          <label className="block text-sm font-semibold text-ink">
            Slido Excel export (.xlsx, up to 5 MB)
            <input
              type="file"
              name="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              required
              className="mt-1 block w-full text-sm text-ink"
            />
          </label>
          <button
            type="submit"
            className="min-h-11 rounded-lg bg-primary px-4 font-bold text-on-primary"
          >
            Upload
          </button>
        </form>

        {imports.length > 0 ? (
          <form method="post" action="/api/reports/slido" className="mt-3">
            <input type="hidden" name="intent" value="clear" />
            <button
              type="submit"
              className="min-h-11 rounded-lg border border-line px-4 text-sm font-semibold text-ink"
            >
              Remove the Slido results
            </button>
          </form>
        ) : null}

        <p className="mt-3 text-sm text-ink-soft">
          Only poll and question sheets are kept. Anything else in the file, such as a participant
          list with email addresses, is left out and never stored.
        </p>
      </section>
    </div>
  );
}
