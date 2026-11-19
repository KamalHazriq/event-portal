import type { Metadata } from 'next';
import { getEventConfig } from '@/lib/config';
import { shortDepartment } from '@/lib/departments';

import { getData } from '@/data';
import { requireAdmin } from '@/lib/admin-guard';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Attendees' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (typeof v === 'string' ? v : '');

const MESSAGES: Record<string, { text: string; good: boolean }> = {
  'no-file': { text: 'Choose a file first.', good: false },
  'too-big': { text: 'That file is over 2 MB. Is it the right one?', good: false },
  'wrong-type': { text: 'Upload an Excel (.xlsx) or CSV file.', good: false },
  unreadable: {
    text: 'That Excel file could not be read. Save it again as .xlsx, or as CSV.',
    good: false,
  },
  nothing: { text: 'Nobody could be read from that file.', good: false },
  'too-many': { text: 'Too many uploads. Wait a few minutes.', good: false },
  'not-confirmed': { text: 'Tick the box to confirm, then press Remove everyone.', good: false },
  'has-check-ins': {
    text: 'Not removed: people have already checked in. Fix individual rows by uploading a corrected list instead.',
    good: false,
  },
};

/**
 * The participant list: upload it, see who is on it, start again if the
 * wrong file went up. Uploading again updates people by staff number, so a
 * corrected list never duplicates anyone and check ins survive.
 */
export default async function AttendeesPage({ searchParams }: { searchParams: SearchParams }) {
  const config = getEventConfig();
  await requireAdmin('/admin/attendees');
  const params = await searchParams;
  const result = one(params.result);
  const q = one(params.q).trim().toLowerCase();

  const everyone = await getData().attendees.list();
  const shown = q
    ? everyone.filter((p) =>
        [p.name, p.staffNo, p.department, p.title].some((v) => v.toLowerCase().includes(q)),
      )
    : everyone;
  const secretariat = everyone.filter((p) => p.isSecretariat).length;
  const departments = new Set(everyone.filter((p) => !p.isSecretariat).map((p) => p.department));
  const withEmail = everyone.filter((p) => p.email).length;

  const problems = one(params.problems)
    .split(' | ')
    .filter((p) => p.length > 0);
  const message =
    result === 'imported'
      ? {
          text: `Uploaded: ${one(params.created)} added, ${one(params.updated)} updated, ${one(params.unchanged)} unchanged${
            one(params.skipped) !== '0' ? `, ${one(params.skipped)} rows skipped` : ''
          }.`,
          good: true,
        }
      : result === 'cleared'
        ? { text: `Removed all ${one(params.removed)} people. Upload the right list.`, good: true }
        : MESSAGES[result];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-ink">Attendees</h1>
        <p className="mt-1 text-ink-soft">
          The participant list. Upload it from Excel or CSV; upload a corrected one any time, and
          people are updated by staff number, never duplicated.
        </p>
      </div>

      {message ? (
        <div
          role={message.good ? 'status' : 'alert'}
          className={`rounded-xl border p-4 text-ink ${
            message.good ? 'border-success bg-success/10' : 'border-warning bg-warning/10'
          }`}
        >
          <p className="font-semibold">{message.text}</p>
          {problems.length > 0 ? (
            <ul className="mt-2 list-disc pl-5 text-sm">
              {problems.map((p) => (
                <li key={p}>Line {p}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-4" aria-label="On the list">
        {[
          ['People', everyone.length],
          ['Participants', everyone.length - secretariat],
          ['Secretariat', secretariat],
          ['Departments', departments.size],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-line bg-surface p-4">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-ink-soft">{label}</p>
            <p className="mt-1 text-3xl font-bold tabular-nums text-ink">{value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-xl border border-line bg-surface p-4">
        <h2 className="font-bold text-ink">Upload the list</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Columns are matched by name: <strong>Staff No</strong>, <strong>Name</strong>, and any of
          Role, Dept, Remarks, Email. People with Secretariat in their role or department are left
          out of the lucky draw and the leaderboard. Someone with no staff number gets one made from
          their name. An Email column makes business card check in instant.
        </p>
        <form
          action="/api/attendees/import"
          method="post"
          encType="multipart/form-data"
          className="mt-3 flex flex-wrap items-center gap-3"
        >
          <label htmlFor="list-file" className="sr-only">
            Participant list file
          </label>
          <input
            id="list-file"
            name="file"
            type="file"
            required
            accept=".xlsx,.csv"
            className="text-sm text-ink"
          />
          <button
            type="submit"
            className="btn-primary min-h-11 rounded-lg bg-primary px-5 font-bold text-on-primary"
          >
            Upload
          </button>
        </form>
      </section>

      <section aria-labelledby="who">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="who" className="font-bold text-ink">
            On the list{q ? `: ${shown.length} matching` : ''}
          </h2>
          <form method="get" className="flex gap-2">
            <label htmlFor="list-search" className="sr-only">
              Search the list
            </label>
            <input
              id="list-search"
              name="q"
              type="search"
              defaultValue={q}
              placeholder="Name, staff no, department"
              className="min-h-11 rounded-lg border border-line bg-canvas px-3 text-ink"
            />
            <button
              type="submit"
              className="min-h-11 rounded-lg border border-line px-4 font-semibold text-ink"
            >
              Search
            </button>
          </form>
        </div>
        <p className="mt-1 text-sm text-ink-soft">
          {withEmail} of {everyone.length} have an email for business card check in.
        </p>

        {everyone.length === 0 ? (
          <p className="mt-3 rounded-xl border border-line bg-surface p-4 text-ink-soft">
            Nobody yet. Upload the participant list above.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-xl border border-line">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted text-ink-soft">
                <tr>
                  <th className="px-3 py-2 font-semibold">No</th>
                  <th className="px-3 py-2 font-semibold">Name</th>
                  <th className="px-3 py-2 font-semibold">Staff no</th>
                  <th className="px-3 py-2 font-semibold">Role</th>
                  <th className="px-3 py-2 font-semibold">Dept</th>
                  <th className="px-3 py-2 font-semibold">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((p) => (
                  <tr key={p.id} className="border-t border-line bg-surface">
                    <td className="px-3 py-2 tabular-nums text-ink-soft">{p.no ?? ''}</td>
                    <td className="px-3 py-2 font-semibold text-ink">
                      {p.name}
                      {p.isSecretariat ? (
                        <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs font-semibold text-ink-soft">
                          Secretariat
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 font-mono text-ink">{p.staffNo}</td>
                    <td className="px-3 py-2 text-ink">{p.title}</td>
                    <td className="px-3 py-2 text-ink" title={p.department}>
                      {shortDepartment(config, p.department)}
                    </td>
                    <td className="px-3 py-2 text-ink-soft">{p.remark}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {everyone.length > 0 ? (
        <details className="rounded-xl border border-line bg-surface p-4">
          <summary className="cursor-pointer font-semibold text-ink">
            Uploaded the wrong file? Remove everyone
          </summary>
          <form
            action="/api/attendees/import"
            method="post"
            encType="multipart/form-data"
            className="mt-3 space-y-3"
          >
            <input type="hidden" name="intent" value="clear" />
            <p className="text-sm text-ink-soft">
              Removes all {everyone.length} people. Only works before anyone has checked in, so it
              cannot wipe the event day.
            </p>
            <label className="flex items-center gap-2 text-ink">
              <input type="checkbox" name="confirm" value="yes" className="size-5" />
              Yes, remove everyone
            </label>
            <button
              type="submit"
              className="min-h-11 rounded-lg border border-warning px-4 font-semibold text-ink"
            >
              Remove everyone
            </button>
          </form>
        </details>
      ) : null}
    </div>
  );
}
