import type { Metadata } from 'next';
import Link from 'next/link';

import { requireAdmin } from '@/lib/admin-guard';
import { PrintButton } from '@/modules/reports/components/PrintButton';
import { buildReportSummary, localDateTime } from '@/modules/reports/logic';
import { loadReportInput } from '@/modules/reports/load';
import { slidoHighlights } from '@/modules/reports/slido';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Report summary' };

const pct = (a: number, b: number) => (b === 0 ? '' : ` (${Math.round((a / b) * 100)}%)`);
const stars = (n: number | null) => (n === null ? 'No ratings' : `${n.toFixed(1)} / 5`);

/**
 * The short PDF summary (Module 7). A page laid out for A4, printed through
 * the browser: "Save as PDF" in the print dialog makes the file. Same choice
 * as the name tags: no PDF library, and a layout change is a CSS edit.
 *
 * Counts and averages only. No names, so the PDF can travel further than
 * the Excel file.
 */
export default async function ReportSummaryPage() {
  await requireAdmin('/admin/reports/summary');

  const input = await loadReportInput();
  const { config } = input;
  const s = buildReportSummary(input);
  const slido = slidoHighlights(input.imports);
  const rated = s.sessions.filter((x) => x.average !== null);
  const top = [...rated].sort((a, b) => (b.average ?? 0) - (a.average ?? 0)).slice(0, 3);

  const th = 'border-b border-line py-1 pr-3 text-left font-semibold text-ink-soft';
  const td = 'border-b border-line py-1 pr-3 align-top text-ink';
  const num = 'border-b border-line py-1 pr-3 text-right tabular-nums text-ink';
  const h2 = 'mt-6 break-after-avoid text-lg font-bold text-ink';

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5 flex flex-wrap items-center gap-3 print:hidden">
        <PrintButton />
        <Link href="/admin/reports" className="text-sm font-semibold text-primary">
          Back to reports
        </Link>
        <p className="w-full text-sm text-ink-soft">
          In the print dialog, choose Save as PDF and A4. It fits on two or three pages.
        </p>
      </div>

      <article className="text-sm leading-snug">
        <div className="border-b-2 border-primary pb-3">
          <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">Event report</p>
          <h1 className="text-2xl font-bold text-ink">{config.event.name}</h1>
          <p className="text-ink-soft">
            {config.event.venue}. Made{' '}
            {localDateTime(input.generatedAt.toISOString(), config.event.timezone)}.
          </p>
        </div>

        <h2 className={h2}>Attendance</h2>
        <p className="mt-1 text-ink">
          {s.guestsAttendedAny} of {s.guests} guests came on at least one day
          {pct(s.guestsAttendedAny, s.guests)}. {s.secretariat} secretariat are not in these
          numbers.
        </p>
        <table className="mt-2 w-full border-collapse">
          <thead>
            <tr>
              <th className={th}>Day</th>
              <th className={`${th} text-right`}>Guests arrived</th>
            </tr>
          </thead>
          <tbody>
            {s.days.map((d) => (
              <tr key={d.dayId}>
                <td className={td}>
                  {d.label}, {d.date}
                </td>
                <td className={num}>
                  {d.guestsArrived} of {d.guests}
                  {pct(d.guestsArrived, d.guests)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <h3 className="mt-4 font-bold text-ink">By department</h3>
        <table className="mt-1 w-full border-collapse">
          <thead>
            <tr>
              <th className={th}>Department</th>
              <th className={`${th} text-right`}>Guests</th>
              {s.days.map((d) => (
                <th key={d.dayId} className={`${th} text-right`}>
                  {d.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {s.byDepartment.map((d) => (
              <tr key={d.department} className="break-inside-avoid">
                <td className={td}>{d.department}</td>
                <td className={num}>{d.people}</td>
                {d.perDay.map((n, i) => (
                  <td key={i} className={num}>
                    {n}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        <h2 className={h2}>Feedback</h2>
        <p className="mt-1 text-ink">
          {s.feedbackAnswers} answers in all. Sessions averaged {stars(s.sessionAverage)}. The event
          as a whole: {stars(s.eventAverage)} from {s.eventAnswers}{' '}
          {s.eventAnswers === 1 ? 'answer' : 'answers'}.
        </p>
        {top.length > 0 ? (
          <p className="mt-1 text-ink">
            Highest rated: {top.map((t) => `${t.title} (${t.average?.toFixed(1)})`).join(', ')}.
          </p>
        ) : null}
        {s.bestSessions.length > 0 ? (
          <p className="mt-1 text-ink">
            Voted best session:{' '}
            {s.bestSessions
              .slice(0, 3)
              .map((b) => `${b.title} (${b.votes})`)
              .join(', ')}
            .
          </p>
        ) : null}
        <table className="mt-2 w-full border-collapse">
          <thead>
            <tr>
              <th className={th}>Session</th>
              <th className={`${th} text-right`}>Answers</th>
              <th className={`${th} text-right`}>Average</th>
            </tr>
          </thead>
          <tbody>
            {s.sessions.map((x) => (
              <tr key={x.formId} className="break-inside-avoid">
                <td className={td}>
                  {x.title}
                  <span className="block text-xs text-ink-soft">{x.when}</span>
                </td>
                <td className={num}>{x.responses}</td>
                <td className={num}>{x.average === null ? '' : x.average.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {s.luckyDrawWinners > 0 ? (
          <>
            <h2 className={h2}>Lucky draw</h2>
            <p className="mt-1 text-ink">
              {s.luckyDrawWinners} {s.luckyDrawWinners === 1 ? 'winner' : 'winners'} across{' '}
              {s.luckyDrawDraws} {s.luckyDrawDraws === 1 ? 'draw' : 'draws'}. The names are in the
              Excel file.
            </p>
          </>
        ) : null}

        <h2 className={h2}>Slido polls and questions</h2>
        {input.imports.length === 0 ? (
          <p className="mt-1 text-ink-soft">
            Not imported yet. Upload the Slido export on the reports page.
          </p>
        ) : (
          <>
            <p className="mt-1 text-ink">
              {slido.pollRows} poll rows across {slido.pollSheets}{' '}
              {slido.pollSheets === 1 ? 'sheet' : 'sheets'}, {slido.questionRows} questions across{' '}
              {slido.questionSheets} {slido.questionSheets === 1 ? 'sheet' : 'sheets'}. The full
              results are in the Excel file.
            </p>
            {slido.pollWinners.length > 0 ? (
              <>
                <h3 className="mt-3 font-bold text-ink">Top answer per poll</h3>
                <ul className="mt-1 list-disc pl-5 text-ink">
                  {slido.pollWinners.slice(0, 10).map((p) => (
                    <li key={p.poll}>
                      {p.poll}: {p.option} ({p.votes})
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
            {slido.topQuestions.length > 0 ? (
              <>
                <h3 className="mt-3 font-bold text-ink">Most liked questions</h3>
                <ol className="mt-1 list-decimal pl-5 text-ink">
                  {slido.topQuestions.map((q, i) => (
                    <li key={i}>
                      {q.text} ({q.likes})
                    </li>
                  ))}
                </ol>
              </>
            ) : null}
          </>
        )}
      </article>
    </div>
  );
}
