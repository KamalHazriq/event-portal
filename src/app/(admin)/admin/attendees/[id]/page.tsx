import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { FormPending } from '@/components/FormPending';
import { getData } from '@/data';
import { requireAdmin } from '@/lib/admin-guard';
import { getEventConfig } from '@/lib/config';
import { saveAttendee } from '@/modules/attendees/actions';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Edit a person' };

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const input =
  'mt-1 block min-h-11 w-full rounded-lg border border-line bg-canvas px-3 text-ink focus:border-primary focus:outline-none';

/** Corrects one person on the list: a missing role, a typo, a department. */
export default async function EditAttendeePage({ params, searchParams }: Props) {
  const { id } = await params;
  await requireAdmin(`/admin/attendees/${id}`);
  const query = await searchParams;
  const person = await getData().attendees.get(id.slice(0, 64));
  if (!person) notFound();
  const config = getEventConfig();

  return (
    <div className="max-w-2xl space-y-5">
      <Link href="/admin/attendees#who" className="nav-pill" aria-label="Back to the list">
        <span aria-hidden="true" className="nav-arrow nav-arrow-back">
          ←
        </span>
        Attendees
      </Link>
      <header>
        <h1 className="text-2xl font-bold text-ink">{person.name}</h1>
        <p className="mt-1 text-ink-soft">
          Staff number <span className="font-mono text-ink">{person.staffNo}</span>. Changes here
          show everywhere at once; their check ins and points stay. Uploading the master list again
          overwrites them, so fix the Excel too.
        </p>
      </header>
      {query.error === 'name' ? (
        <p role="alert" className="font-semibold text-warning">
          The name cannot be empty.
        </p>
      ) : null}
      <form
        action={saveAttendee}
        className="space-y-4 rounded-xl border border-line bg-surface p-4"
      >
        <FormPending label="Saving" />
        <input type="hidden" name="id" value={person.id} />
        <label className="block text-sm font-semibold text-ink">
          Name
          <input name="name" required defaultValue={person.name} className={input} />
        </label>
        <label className="block text-sm font-semibold text-ink">
          Role
          <input
            name="title"
            defaultValue={person.title}
            placeholder="For example Lead, Head, Technical Expert"
            className={input}
          />
        </label>
        <label className="block text-sm font-semibold text-ink">
          Department
          <input
            name="department"
            defaultValue={person.department}
            list="departments"
            className={input}
          />
          <datalist id="departments">
            {config.departments.map((d) => (
              <option key={d.short} value={d.name}>
                {d.short}
              </option>
            ))}
          </datalist>
        </label>
        <label className="block text-sm font-semibold text-ink">
          Email (for business card check in)
          <input name="email" type="email" defaultValue={person.email} className={input} />
        </label>
        <label className="block text-sm font-semibold text-ink">
          Remarks
          <input name="remark" defaultValue={person.remark} className={input} />
        </label>
        <label className="flex min-h-11 items-center gap-3 text-ink">
          <input
            type="checkbox"
            name="secretariat"
            defaultChecked={person.isSecretariat}
            className="size-5"
          />
          Secretariat (left out of the leaderboard and the lucky draw)
        </label>
        <button
          type="submit"
          className="min-h-11 rounded-lg bg-primary px-5 font-bold text-on-primary"
        >
          Save
        </button>
      </form>
    </div>
  );
}
