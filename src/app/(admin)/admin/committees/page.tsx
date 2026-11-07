import type { Metadata } from 'next';

import { requireAdmin } from '@/lib/admin-guard';
import { PreviewBanner } from '@/modules/previews/components/PreviewBanner';
import { COMMITTEES, mockCommitteeItems } from '@/modules/previews/mock-data';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Committee summary' };

const DECISION_STYLE: Record<string, string> = {
  Approved: 'text-success',
  'Approved with conditions': 'text-success',
  Noted: 'text-ink-soft',
  Deferred: 'text-warning',
};

export default async function CommitteesPage() {
  await requireAdmin('/admin/committees');

  const items = mockCommitteeItems();

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-ink">Committee summary</h1>
        <p className="mt-1 text-ink-soft">
          Upload the committee Excel and the portal shows a read only summary. Starting with SVC.
        </p>
      </header>

      <PreviewBanner module="Extra, SVC, ATC and OTC summary">
        Every paper below is invented. Who can see the summary will be an admin setting.
      </PreviewBanner>

      <section className="rounded-xl border border-line bg-surface p-4">
        <label className="block text-sm font-semibold text-ink">
          Committee Excel
          <input type="file" accept=".xlsx" disabled className="mt-1 block w-full text-sm" />
        </label>
        <fieldset className="mt-3">
          <legend className="text-sm font-semibold text-ink">Who can see the summary</legend>
          {['Secretariat only', 'Secretariat and committee members', 'Everyone signed in'].map(
            (option, i) => (
              <label key={option} className="mt-1 flex min-h-11 items-center gap-2 text-ink">
                <input type="radio" name="access" defaultChecked={i === 0} disabled />
                {option}
              </label>
            ),
          )}
        </fieldset>
      </section>

      {COMMITTEES.map((committee) => {
        const rows = items[committee.id];
        const approved = rows.filter((r) => r.decision.startsWith('Approved')).length;
        return (
          <section key={committee.id} className="rounded-xl border border-line bg-surface p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-bold text-ink">{committee.name}</h2>
              <p className="text-sm text-ink-soft">
                {rows.length} papers, {approved} approved
              </p>
            </div>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full min-w-[32rem] text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-ink-soft">
                    <th className="py-1 pr-2 font-semibold">Ref</th>
                    <th className="py-1 pr-2 font-semibold">Paper</th>
                    <th className="py-1 pr-2 font-semibold">Division</th>
                    <th className="py-1 pr-2 font-semibold">Meeting</th>
                    <th className="py-1 font-semibold">Decision</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.ref} className="border-b border-line align-top last:border-0">
                      <td className="py-1.5 pr-2 font-mono text-ink-soft">{row.ref}</td>
                      <td className="py-1.5 pr-2 text-ink">{row.title}</td>
                      <td className="py-1.5 pr-2 text-ink-soft">{row.division}</td>
                      <td className="py-1.5 pr-2 font-mono text-ink-soft">{row.meeting}</td>
                      <td className={`py-1.5 font-semibold ${DECISION_STYLE[row.decision] ?? ''}`}>
                        {row.decision}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}
