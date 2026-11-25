import type { Metadata } from 'next';
import Link from 'next/link';

import { getData } from '@/data';
import { requireAdmin } from '@/lib/admin-guard';
import { getEventConfig } from '@/lib/config';
import { updateFormOpen } from '@/modules/feedback/admin-actions';
import { feedbackForms, formatAverage, slugForFormId } from '@/modules/feedback/logic';
import { readAllFormSettings } from '@/modules/feedback/settings';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Feedback' };

/**
 * Results for every feedback form, and the settings that govern them.
 *
 * Each control is a small form posting to a Server Action, so the whole page
 * works without JavaScript.
 */
export default async function AdminFeedbackPage() {
  await requireAdmin('/admin/feedback');

  const config = getEventConfig();
  const forms = feedbackForms(config);
  const [{ byForm }, summaries] = await Promise.all([
    readAllFormSettings(forms),
    getData().feedback.summaries(),
  ]);

  const summaryFor = new Map(summaries.map((summary) => [summary.formId, summary]));
  const totalResponses = summaries.reduce((count, summary) => count + summary.responses, 0);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-ink">Feedback</h1>
        <p className="mt-1 text-ink-soft">
          {totalResponses} {totalResponses === 1 ? 'answer' : 'answers'} across {forms.length}{' '}
          forms.
        </p>
      </header>

      {!config.features.feedback ? (
        <p className="rounded-lg border-2 border-warning bg-warning/10 p-3 font-semibold text-ink">
          Feedback is switched off in config/event.json, so nobody can answer these forms yet. Set
          features.feedback to true.
        </p>
      ) : null}

      <p className="rounded-xl border border-line bg-surface p-4 text-ink-soft">
        Every answer carries the name the person signed in with. There is no anonymous feedback.
      </p>

      <section>
        <h2 className="mb-2 text-lg font-bold text-ink">Forms</h2>
        <ul className="space-y-3">
          {forms.map((form) => {
            const settings = byForm.get(form.id);
            const summary = summaryFor.get(form.id);
            const responses = summary?.responses ?? 0;

            return (
              <li key={form.id} className="rounded-xl border border-line bg-surface p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link
                      href={`/admin/feedback/${slugForFormId(form.id)}`}
                      className="font-bold text-ink no-underline hover:text-primary"
                    >
                      {form.title}
                    </Link>
                    <p className="text-sm text-ink-soft">{form.context}</p>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="text-2xl font-bold tabular-nums leading-none text-ink">
                      {responses}
                    </p>
                    <p className="text-xs text-ink-soft">
                      {responses === 1 ? 'answer' : 'answers'}
                    </p>
                  </div>
                </div>

                <p className="mt-2 text-sm text-ink">
                  {formatAverage(summary?.averageRating ?? null)}
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <form action={updateFormOpen}>
                    <input type="hidden" name="formId" value={form.id} />
                    <input type="hidden" name="open" value={settings?.open ? 'closed' : 'open'} />
                    <button
                      type="submit"
                      className={[
                        'min-h-11 rounded-lg px-3 py-1 text-sm font-bold',
                        settings?.open ? 'border border-line text-ink' : 'bg-warning/20 text-ink',
                      ].join(' ')}
                    >
                      {settings?.open ? 'Close this form' : 'Closed, reopen it'}
                    </button>
                  </form>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
