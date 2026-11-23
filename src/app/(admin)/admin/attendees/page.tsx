import type { Metadata } from 'next';
import { getEventConfig } from '@/lib/config';
import { shortDepartment } from '@/lib/departments';

import { getData } from '@/data';
import { requireAdmin } from '@/lib/admin-guard';
import { FormPending } from '@/components/FormPending';
import { saveSecretariatList, setAskNameFirst } from '@/modules/attendees/actions';
import { ASK_FIRST_KEY } from '@/modules/identity/logic';
import { readSecretariatList } from '@/modules/attendees/secretariat';
import { AttendeeTable, type AttendeeRow } from '@/modules/attendees/components/AttendeeTable';

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
  const secretariatList = await readSecretariatList();
  const askFirst =
    config.features.askNameFirst && (await getData().settings.get(ASK_FIRST_KEY)) !== 'off';
  const result = one(params.result);
  const everyone = await getData().attendees.list();
  const rows: AttendeeRow[] = everyone.map((p) => ({
    id: p.id,
    no: p.no,
    name: p.name,
    staffNo: p.staffNo,
    title: p.title,
    department: shortDepartment(config, p.department),
    departmentFull: p.department,
    remark: p.remark,
    isSecretariat: p.isSecretariat,
  }));
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

      {config.features.askNameFirst ? (
        <section className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface p-4">
          <div className="min-w-0 flex-1">
            <h2 className="font-bold text-ink">Ask new phones who they are</h2>
            <p className="text-sm text-ink-soft">
              {askFirst
                ? 'On: a phone or laptop opening the portal for the first time types its name and confirms it, so everything it does links to that person. Signed in desks are never asked.'
                : 'Off: phones go straight in. People can still say who they are on My points.'}
            </p>
          </div>
          <form action={setAskNameFirst}>
            <input type="hidden" name="mode" value={askFirst ? 'off' : 'on'} />
            <button
              type="submit"
              className="min-h-11 rounded-lg border border-line px-4 font-semibold text-ink hover:border-primary"
            >
              {askFirst ? 'Turn it off' : 'Turn it on'}
            </button>
          </form>
        </section>
      ) : null}

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
        <h2 id="who" className="font-bold text-ink">
          On the list
        </h2>
        {params.edited === '1' ? (
          <p role="status" className="mt-1 font-semibold text-ink">
            Saved. The changes show everywhere now.
          </p>
        ) : null}
        <p className="mt-1 text-sm text-ink-soft">
          {withEmail} of {everyone.length} have an email for business card check in.
        </p>

        {everyone.length === 0 ? (
          <p className="mt-3 rounded-xl border border-line bg-surface p-4 text-ink-soft">
            Nobody yet. Upload the participant list above.
          </p>
        ) : (
          <div className="mt-3">
            <AttendeeTable rows={rows} />
          </div>
        )}
      </section>

      <details
        id="secretariat"
        className="scroll-mt-24 rounded-xl border border-line bg-surface p-4"
        open={params.secretariat === 'saved'}
      >
        <summary className="cursor-pointer text-lg font-bold text-ink">
          The secretariat ({secretariat} marked)
        </summary>
        <p className="mt-1 text-sm text-ink-soft">
          The secretariat are left out of the leaderboard and the lucky draw (they are still
          welcomed on the arrivals screen). Anyone whose department, role or remark says Secretariat
          is found by itself, so there is nothing to do for them. Only if someone is missed, paste
          their staff number here: it stays marked when you upload the list again.
        </p>
        {params.secretariat === 'saved' ? (
          <p role="status" className="mt-2 font-semibold text-ink">
            Saved. The secretariat are marked.
          </p>
        ) : null}
        <form action={saveSecretariatList} className="mt-3 space-y-3">
          <FormPending label="Saving" />
          <label className="block text-sm font-semibold text-ink">
            Staff numbers of the secretariat
            <textarea
              name="staffNos"
              rows={4}
              defaultValue={secretariatList.join('\n')}
              placeholder={'One per line, for example\nD10001\nD10002'}
              className="mt-1 block w-full rounded-lg border border-line bg-canvas px-3 py-2 font-mono text-ink"
            />
          </label>
          <button
            type="submit"
            className="min-h-11 rounded-lg bg-primary px-4 font-bold text-on-primary"
          >
            Save the secretariat list
          </button>
        </form>
      </details>

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
