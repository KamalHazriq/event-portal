'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

export type AttendeeRow = {
  id: string;
  no: number | null;
  name: string;
  staffNo: string;
  title: string;
  department: string;
  departmentFull: string;
  remark: string;
  isSecretariat: boolean;
};

type Filter = 'all' | 'no-role' | 'secretariat';

/**
 * The participant list, filtered as you type: a name, a staff number, a role
 * or a department. "No role" finds the people whose role is empty, to fill in.
 */
export function AttendeeTable({ rows }: { rows: AttendeeRow[] }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const noRole = rows.filter((r) => !r.title.trim()).length;
  const secretariat = rows.filter((r) => r.isSecretariat).length;

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter === 'no-role' && r.title.trim()) return false;
      if (filter === 'secretariat' && !r.isSecretariat) return false;
      if (!q) return true;
      return [r.name, r.staffNo, r.title, r.department, r.departmentFull, r.remark].some((v) =>
        v.toLowerCase().includes(q),
      );
    });
  }, [rows, query, filter]);

  const chip = (value: Filter, label: string) => (
    <button
      type="button"
      onClick={() => setFilter(value)}
      aria-pressed={filter === value}
      className={[
        'min-h-10 rounded-full border px-3.5 text-sm font-semibold transition-colors',
        filter === value
          ? 'border-primary bg-primary text-on-primary'
          : 'border-line text-ink hover:border-primary hover:text-primary',
      ].join(' ')}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="list-search" className="sr-only">
          Search the list
        </label>
        <input
          id="list-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search a name, staff number, role or department…"
          className="min-h-11 w-full flex-1 rounded-lg border border-line bg-canvas px-3 text-ink focus:border-primary focus:outline-none sm:min-w-80"
        />
        {chip('all', `Everyone (${rows.length})`)}
        {chip('no-role', `No role (${noRole})`)}
        {chip('secretariat', `Secretariat (${secretariat})`)}
      </div>
      <p className="text-sm text-ink-soft" role="status">
        {shown.length === rows.length
          ? `${rows.length} people`
          : `${shown.length} of ${rows.length} people`}
      </p>
      {shown.length === 0 ? (
        <p className="rounded-xl border border-line bg-surface p-4 text-ink-soft">
          Nobody matches.
        </p>
      ) : (
        <div className="relative max-w-full overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[44rem] table-fixed text-left text-sm lg:min-w-0">
            {/* Fixed widths, so the columns stay put as the list filters. */}
            <colgroup>
              <col className="w-10" />
              <col className="w-[27%]" />
              <col className="w-24" />
              <col className="w-[21%]" />
              <col className="w-20" />
              <col className="w-[15%]" />
              <col className="w-16" />
            </colgroup>
            <thead className="bg-muted text-ink-soft">
              <tr>
                <th className="px-2 py-2 font-semibold">No</th>
                <th className="px-2 py-2 font-semibold">Name</th>
                <th className="px-2 py-2 font-semibold">Staff no</th>
                <th className="px-2 py-2 font-semibold">Role</th>
                <th className="px-2 py-2 font-semibold">Dept</th>
                <th className="px-2 py-2 font-semibold">Remarks</th>
                <th className="px-2 py-2 font-semibold">
                  <span className="sr-only">Edit</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.map((p) => (
                <tr key={p.id} className="border-t border-line bg-surface hover:bg-muted/40">
                  <td className="px-2 py-2 tabular-nums text-ink-soft">{p.no ?? ''}</td>
                  <td className="break-words px-2 py-2 font-semibold text-ink">
                    {p.name}
                    {p.isSecretariat ? (
                      <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs font-semibold text-ink-soft">
                        Secretariat
                      </span>
                    ) : null}
                  </td>
                  <td className="px-2 py-2 font-mono text-ink">{p.staffNo}</td>
                  <td className="break-words px-2 py-2 text-ink">
                    {p.title || <span className="text-warning">No role</span>}
                  </td>
                  <td className="truncate px-2 py-2 text-ink" title={p.departmentFull}>
                    {p.department}
                  </td>
                  <td className="break-words px-2 py-2 text-ink-soft">{p.remark}</td>
                  <td className="px-2 py-2">
                    <Link
                      href={`/admin/attendees/${p.id}`}
                      aria-label={`Edit ${p.name}`}
                      className="inline-flex min-h-9 items-center rounded-lg border border-line px-2 text-sm font-semibold text-ink no-underline transition-colors hover:border-primary hover:text-primary"
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
