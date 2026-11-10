import type { ImportedSheet } from '@/data/types';

import { columnTallies } from '../logic';

/** How many rows to show before folding the rest away. */
const FIRST_ROWS = 12;

function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[36rem] text-left text-sm">
        <thead>
          <tr className="border-b border-line text-ink-soft">
            {headers.map((h, i) => (
              <th key={i} scope="col" className="py-1.5 pr-3 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r} className="border-b border-line align-top last:border-0">
              {row.map((cell, c) => (
                <td key={c} className="py-1.5 pr-3 text-ink">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * The read only view of one committee's upload: counts for the columns that
 * look like categories, then the rows themselves. Used by the admin page
 * and, when access allows, by the attendee page.
 */
export function CommitteeSummary({ sheets }: { sheets: ImportedSheet[] }) {
  return (
    <div className="space-y-5">
      {sheets.map((sheet) => {
        const tallies = columnTallies(sheet.headers, sheet.rows);
        const first = sheet.rows.slice(0, FIRST_ROWS);
        const rest = sheet.rows.slice(FIRST_ROWS);
        return (
          <div key={sheet.id}>
            {sheets.length > 1 ? <h3 className="font-bold text-ink">{sheet.name}</h3> : null}
            <p className="text-sm text-ink-soft">
              {sheet.rows.length} {sheet.rows.length === 1 ? 'row' : 'rows'}
            </p>

            {tallies.length > 0 ? (
              <dl className="mt-2 grid gap-3 sm:grid-cols-2">
                {tallies.map((tally) => (
                  <div key={tally.header} className="rounded-lg bg-muted p-3">
                    <dt className="text-xs font-bold uppercase tracking-wide text-ink-soft">
                      {tally.header}
                    </dt>
                    <dd className="mt-1 space-y-0.5">
                      {tally.counts.map((c) => (
                        <p key={c.value} className="flex justify-between gap-3 text-sm text-ink">
                          <span>{c.value}</span>
                          <span className="font-bold tabular-nums">{c.count}</span>
                        </p>
                      ))}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null}

            <div className="mt-3">
              <Table headers={sheet.headers} rows={first} />
              {rest.length > 0 ? (
                <details className="mt-2">
                  <summary className="cursor-pointer text-sm font-semibold text-primary">
                    Show the other {rest.length} rows
                  </summary>
                  <div className="mt-2">
                    <Table headers={sheet.headers} rows={rest} />
                  </div>
                </details>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
