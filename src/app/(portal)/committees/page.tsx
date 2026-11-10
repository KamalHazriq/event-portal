import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { getData } from '@/data';
import { getEventConfig } from '@/lib/config';
import { CommitteeSummary } from '@/modules/committees/components/CommitteeSummary';
import {
  COMMITTEE_ACCESS_KEY,
  committeeSource,
  resolveCommitteeAccess,
} from '@/modules/committees/logic';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Committee summary' };

/**
 * The read only committee summary for attendees. It only exists while an
 * admin has set access to "anyone with the portal link". Otherwise it is
 * not found, exactly as if the page were never built.
 */
export default async function CommitteesPortalPage() {
  const config = getEventConfig();
  if (!config.features.committees) notFound();

  const data = getData();
  const access = resolveCommitteeAccess(await data.settings.get(COMMITTEE_ACCESS_KEY));
  if (access !== 'everyone') notFound();

  const uploads = await Promise.all(
    config.committees.map((c) => data.imports.list(committeeSource(c.id))),
  );
  const any = uploads.some((sheets) => sheets.length > 0);

  return (
    <div className="space-y-5 py-2">
      <h1 className="text-2xl font-bold text-ink">Committee summary</h1>

      {!any ? <p className="text-ink-soft">Nothing has been shared yet.</p> : null}

      {config.committees.map((committee, i) => {
        const sheets = uploads[i] ?? [];
        if (sheets.length === 0) return null;
        return (
          <section key={committee.id} className="rounded-xl border border-line bg-surface p-4">
            <h2 className="mb-2 text-lg font-bold text-ink">{committee.name}</h2>
            <CommitteeSummary sheets={sheets} />
          </section>
        );
      })}
    </div>
  );
}
