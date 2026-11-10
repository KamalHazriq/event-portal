import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getData } from '@/data';
import { requireAdmin } from '@/lib/admin-guard';
import { getEventConfig } from '@/lib/config';
import { CommitteeSummary } from '@/modules/committees/components/CommitteeSummary';
import {
  COMMITTEE_ACCESS,
  COMMITTEE_ACCESS_KEY,
  committeeAccessLabel,
  committeeSource,
  resolveCommitteeAccess,
} from '@/modules/committees/logic';
import { localDateTime } from '@/modules/reports/logic';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Committee summary' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (typeof v === 'string' ? v : null);

function message(code: string | null, kept: string | null): { ok: boolean; text: string } | null {
  switch (code) {
    case 'imported':
      return { ok: true, text: `Uploaded. ${Number(kept) || 0} sheet(s) are in the summary.` };
    case 'cleared':
      return { ok: true, text: 'That committee file was removed.' };
    case 'access-saved':
      return { ok: true, text: 'Saved who can see the summaries.' };
    case 'no-file':
      return { ok: false, text: 'Choose the Excel file first.' };
    case 'not-xlsx':
      return { ok: false, text: 'That is not an .xlsx file. Save it from Excel as .xlsx.' };
    case 'too-big':
      return { ok: false, text: 'That file is over 5 MB.' };
    case 'unreadable':
      return { ok: false, text: 'That file could not be read. Save it again as .xlsx and retry.' };
    case 'nothing-found':
      return { ok: false, text: 'No table was found in that file.' };
    case 'too-many':
      return { ok: false, text: 'Too many uploads in a row. Wait a few minutes.' };
    case 'no-committee':
    case 'failed':
      return { ok: false, text: 'Something went wrong. Try again.' };
    default:
      return null;
  }
}

export default async function CommitteesPage({ searchParams }: { searchParams: SearchParams }) {
  await requireAdmin('/admin/committees');
  const params = await searchParams;

  const config = getEventConfig();
  if (!config.features.committees) notFound();

  const data = getData();
  const [access, uploads] = await Promise.all([
    data.settings.get(COMMITTEE_ACCESS_KEY).then(resolveCommitteeAccess),
    Promise.all(config.committees.map((c) => data.imports.list(committeeSource(c.id)))),
  ]);
  const note = message(one(params.result), one(params.kept));
  const noteFor = one(params.c);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-ink">Committee summary</h1>
        <p className="mt-1 text-ink-soft">
          Upload a committee&apos;s Excel and the portal shows a read only summary: the rows as they
          are, and a count for each column that looks like a status or a category.
        </p>
      </div>

      {note && !noteFor ? (
        <p
          role="status"
          className={`rounded-lg border p-3 text-sm font-semibold ${note.ok ? 'border-success text-success' : 'border-warning text-warning'}`}
        >
          {note.text}
        </p>
      ) : null}

      <section className="rounded-xl border border-line bg-surface p-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-ink-soft">
          Who can see the summaries
        </h2>
        <form method="post" action="/api/committees" className="mt-2">
          <input type="hidden" name="intent" value="access" />
          {COMMITTEE_ACCESS.map((option) => (
            <label key={option} className="flex min-h-11 items-center gap-3 text-ink">
              <input
                type="radio"
                name="access"
                value={option}
                defaultChecked={access === option}
                className="size-5"
              />
              {committeeAccessLabel(option)}
            </label>
          ))}
          <button
            type="submit"
            className="mt-2 min-h-11 rounded-lg border border-line px-4 font-semibold text-ink"
          >
            Save
          </button>
        </form>
        <p className="mt-3 text-sm text-ink-soft">
          {access === 'everyone' ? (
            <>
              Attendees can open{' '}
              <Link href="/committees" className="font-semibold text-primary">
                the committee page
              </Link>
              . The portal has no personal login yet, so this means anyone who has the link.
            </>
          ) : (
            'Only desks signed in with the PIN can see them, on this page.'
          )}
        </p>
      </section>

      {config.committees.length === 0 ? (
        <p className="rounded-lg border border-line bg-surface p-4 text-ink-soft">
          No committees are listed in config/event.json.
        </p>
      ) : null}

      {config.committees.map((committee, i) => {
        const sheets = uploads[i] ?? [];
        const firstSheet = sheets[0];
        return (
          <section
            key={committee.id}
            id={committee.id}
            className="rounded-xl border border-line bg-surface p-4"
          >
            <h2 className="text-lg font-bold text-ink">{committee.name}</h2>

            {note && noteFor === committee.id ? (
              <p
                role="status"
                className={`mt-2 rounded-lg border p-3 text-sm font-semibold ${note.ok ? 'border-success text-success' : 'border-warning text-warning'}`}
              >
                {note.text}
              </p>
            ) : null}

            {firstSheet ? (
              <>
                <p className="mt-1 text-sm text-ink-soft">
                  {firstSheet.fileName}, uploaded{' '}
                  {localDateTime(firstSheet.importedAt, config.event.timezone)} by{' '}
                  <span className="font-mono">{firstSheet.byOperator}</span>
                </p>
                <div className="mt-3">
                  <CommitteeSummary sheets={sheets} />
                </div>
              </>
            ) : (
              <p className="mt-1 text-sm text-ink-soft">Nothing uploaded yet.</p>
            )}

            <form
              method="post"
              action="/api/committees"
              encType="multipart/form-data"
              className="mt-4 flex flex-wrap items-end gap-2 border-t border-line pt-3"
            >
              <input type="hidden" name="committee" value={committee.id} />
              <label className="min-w-0 flex-1 text-sm font-semibold text-ink">
                {firstSheet ? 'Replace with a newer file' : `${committee.name} Excel (.xlsx)`}
                <input
                  type="file"
                  name="file"
                  accept=".xlsx"
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

            {firstSheet ? (
              <form method="post" action="/api/committees" className="mt-2">
                <input type="hidden" name="committee" value={committee.id} />
                <input type="hidden" name="intent" value="clear" />
                <button
                  type="submit"
                  className="min-h-11 rounded-lg border border-line px-4 text-sm font-semibold text-ink"
                >
                  Remove this file
                </button>
              </form>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
