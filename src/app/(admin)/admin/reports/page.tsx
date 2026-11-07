import type { Metadata } from 'next';

import { getData } from '@/data';
import { requireAdmin } from '@/lib/admin-guard';
import { getEventConfig } from '@/lib/config';
import { formatShortDate } from '@/lib/time';
import { checkInDays } from '@/modules/check-in/logic';
import { formatAverage } from '@/modules/feedback/logic';
import { PreviewBanner } from '@/modules/previews/components/PreviewBanner';
import { mockSlidoImport, REPORT_SHEETS } from '@/modules/previews/mock-data';
import { buildAgenda, isProgrammeSession } from '@/modules/schedule/logic';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Reports' };

export default async function ReportsPage() {
  await requireAdmin('/admin/reports');

  const config = getEventConfig();
  const agenda = buildAgenda(config);
  const data = getData();

  const days = checkInDays(config);
  const [headcounts, summaries] = await Promise.all([
    Promise.all(days.map((day) => data.checkIns.headcount(day.id))),
    data.feedback.summaries(),
  ]);

  const responses = summaries.reduce((sum, s) => sum + s.responses, 0);
  const slido = mockSlidoImport(
    agenda.sessions.filter((s) => isProgrammeSession(s) && s.qaEnabled).map((s) => s.title),
  );

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-ink">Reports</h1>
        <p className="mt-1 text-ink-soft">
          One click for the whole event in Excel, one sheet per topic, and a short PDF summary.
        </p>
      </header>

      <PreviewBanner module="Module 7, report export">
        The attendance and feedback numbers below are real, from this database. The Slido rows are
        invented.
      </PreviewBanner>

      <section className="rounded-xl border border-line bg-surface p-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-ink-soft">What goes in</h2>
        <div className="mt-2 grid gap-3 sm:grid-cols-3">
          {headcounts.map((h, i) => {
            const day = days[i];
            return (
              <div key={h.dayId} className="rounded-lg bg-muted p-3">
                <p className="text-sm text-ink-soft">
                  {day?.label}
                  {day ? `, ${formatShortDate(day.date, config.event.timezone)}` : ''}
                </p>
                <p className="text-2xl font-bold tabular-nums text-ink">
                  {h.arrived}
                  <span className="text-base font-normal text-ink-soft"> / {h.expected}</span>
                </p>
              </div>
            );
          })}
          <div className="rounded-lg bg-muted p-3">
            <p className="text-sm text-ink-soft">Feedback answers</p>
            <p className="text-2xl font-bold tabular-nums text-ink">{responses}</p>
            <p className="text-sm text-ink-soft">across {summaries.length} forms</p>
          </div>
        </div>

        {summaries.length > 0 ? (
          <table className="mt-4 w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-ink-soft">
                <th className="py-1 font-semibold">Form</th>
                <th className="py-1 text-right font-semibold">Answers</th>
                <th className="py-1 text-right font-semibold">Average</th>
              </tr>
            </thead>
            <tbody>
              {summaries.slice(0, 8).map((s) => (
                <tr key={s.formId} className="border-b border-line last:border-0">
                  <td className="py-1.5 text-ink">
                    {agenda.byId.get(s.formId)?.title ?? 'Final event form'}
                  </td>
                  <td className="py-1.5 text-right tabular-nums text-ink">{s.responses}</td>
                  <td className="py-1.5 text-right tabular-nums text-ink">
                    {formatAverage(s.averageRating)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="mt-3 text-sm text-ink-soft">
            No feedback yet. Run npm run demo:seed to fill the database with dummy answers.
          </p>
        )}
      </section>

      <section className="rounded-xl border border-line bg-surface p-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-ink-soft">
          Sheets in the Excel file
        </h2>
        <ul className="mt-2 divide-y divide-line">
          {REPORT_SHEETS.map((sheet) => (
            <li key={sheet.name} className="flex flex-wrap justify-between gap-2 py-2">
              <span className="font-semibold text-ink">{sheet.name}</span>
              <span className="text-sm text-ink-soft">{sheet.source}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled
            className="min-h-11 rounded-lg bg-primary px-4 font-bold text-on-primary opacity-50"
          >
            Download Excel
          </button>
          <button
            type="button"
            disabled
            className="min-h-11 rounded-lg border border-line px-4 font-semibold text-ink opacity-50"
          >
            Download PDF summary
          </button>
        </div>
        <p className="mt-2 text-sm text-ink-soft">The downloads arrive with Module 7.</p>
      </section>

      <section className="rounded-xl border border-line bg-surface p-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-ink-soft">Slido results</h2>
        <p className="mt-1 text-sm text-ink">
          After the event, export the Slido results to Excel and upload the file here. Poll and Q&A
          results then land in the same report.
        </p>
        <label className="mt-3 block text-sm font-semibold text-ink">
          Slido Excel export
          <input
            type="file"
            accept=".xlsx"
            disabled
            className="mt-1 block w-full text-sm text-ink-soft"
          />
        </label>

        <p className="mt-4 text-sm font-semibold text-ink">What an import will look like</p>
        <div className="mt-1 overflow-x-auto">
          <table className="w-full min-w-[32rem] text-left text-sm">
            <thead>
              <tr className="border-b border-line text-ink-soft">
                <th className="py-1 pr-2 font-semibold">Sheet</th>
                <th className="py-1 pr-2 font-semibold">Session</th>
                <th className="py-1 pr-2 font-semibold">Poll or question</th>
                <th className="py-1 font-semibold">Result</th>
              </tr>
            </thead>
            <tbody>
              {slido.map((row, i) => (
                <tr key={i} className="border-b border-line align-top last:border-0">
                  <td className="py-1.5 pr-2 text-ink-soft">{row.sheet}</td>
                  <td className="py-1.5 pr-2 text-ink">{row.session}</td>
                  <td className="py-1.5 pr-2 text-ink">{row.item}</td>
                  <td className="py-1.5 text-ink-soft">{row.result}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
