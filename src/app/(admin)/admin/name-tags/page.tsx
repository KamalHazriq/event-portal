import type { Metadata } from 'next';
import Link from 'next/link';

import { QrCode } from '@/components/QrCode';
import { getData } from '@/data';
import { requireAdmin } from '@/lib/admin-guard';
import { getEventConfig } from '@/lib/config';
import { buildCheckInUrl } from '@/modules/check-in/logic';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Name tags' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | null {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value[0] ?? null;
  return null;
}

/**
 * Printable name tags.
 *
 * Front: name, title, department and the personal check in QR.
 * Back: the portal QR, the same for everyone.
 *
 * Printed through the browser rather than built as a PDF file. "Print to PDF"
 * in the print dialog gives the same PDF, and this way the tags can be
 * adjusted by editing CSS instead of redoing a PDF layout. Sizes are in
 * millimetres so they land correctly on pre cut badge stock.
 */
export default async function NameTagsPage({ searchParams }: { searchParams: SearchParams }) {
  await requireAdmin('/admin/name-tags');

  const config = getEventConfig();
  const params = await searchParams;
  const side = first(params.side) === 'back' ? 'back' : 'front';
  const includeSecretariat = first(params.include) !== 'attendees';

  const data = getData();
  const everyone = await data.attendees.list();
  const people = includeSecretariat ? everyone : everyone.filter((person) => !person.isSecretariat);

  const portalUrl = config.event.portalUrl;

  return (
    <div className="space-y-5">
      <div className="print:hidden">
        <header>
          <h1 className="text-2xl font-bold text-ink">Name tags</h1>
          <p className="mt-1 text-ink-soft">
            {people.length} tags, {side === 'front' ? 'fronts' : 'backs'}. Print, then use your
            browser&apos;s Save as PDF if you want a file.
          </p>
        </header>

        <section className="mt-3 rounded-lg border border-line bg-surface p-4">
          <h2 className="font-bold text-ink">Before you print</h2>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-ink">
            <li>Print the fronts, then put the same sheets back in and print the backs.</li>
            <li>
              In the print dialog, set margins to None and turn off headers and footers, or the tags
              will not line up.
            </li>
            <li>Check one page before printing all {people.length}.</li>
            <li>
              Each front carries that person&apos;s own code. Do not photocopy a sheet, or two
              people end up with the same tag.
            </li>
          </ol>
        </section>

        <nav className="mt-3 flex flex-wrap gap-2" aria-label="Name tag options">
          <Link
            href={`/admin/name-tags?side=front&include=${includeSecretariat ? 'all' : 'attendees'}`}
            aria-current={side === 'front' ? 'page' : undefined}
            className={`rounded-lg border px-3 py-2 text-sm no-underline ${
              side === 'front'
                ? 'border-primary bg-primary font-bold text-on-primary'
                : 'border-line bg-surface font-semibold text-ink'
            }`}
          >
            Fronts
          </Link>
          <Link
            href={`/admin/name-tags?side=back&include=${includeSecretariat ? 'all' : 'attendees'}`}
            aria-current={side === 'back' ? 'page' : undefined}
            className={`rounded-lg border px-3 py-2 text-sm no-underline ${
              side === 'back'
                ? 'border-primary bg-primary font-bold text-on-primary'
                : 'border-line bg-surface font-semibold text-ink'
            }`}
          >
            Backs
          </Link>
          <Link
            href={`/admin/name-tags?side=${side}&include=${includeSecretariat ? 'attendees' : 'all'}`}
            className="rounded-lg border border-line bg-surface px-3 py-2 text-sm font-semibold text-ink no-underline"
          >
            {includeSecretariat ? 'Leave out secretariat' : 'Include secretariat'}
          </Link>
        </nav>

        {portalUrl.includes('example.com') ? (
          <p className="mt-3 rounded-lg border-2 border-warning bg-warning/10 p-3 font-semibold text-ink">
            The portal address is still the placeholder. Set event.portalUrl in config/event.json
            before printing anything, or every QR code will point at nothing.
          </p>
        ) : null}
      </div>

      {/* Only this part goes on paper. */}
      <div className="tag-sheet">
        {people.map((person) => (
          <div key={person.id} className="tag">
            {side === 'front' ? (
              <>
                <div className="tag-text">
                  <p className="tag-name">{person.name}</p>
                  {person.title ? <p className="tag-title">{person.title}</p> : null}
                  {person.department ? <p className="tag-dept">{person.department}</p> : null}
                </div>
                <QrCode
                  value={buildCheckInUrl(portalUrl, person.checkInToken)}
                  label={`Check in code for ${person.name}`}
                  className="tag-qr"
                />
              </>
            ) : (
              <div className="tag-back">
                <QrCode value={portalUrl} label="Event portal" className="tag-qr-back" />
                <p className="tag-back-label">Scan for the agenda</p>
                <p className="tag-back-event">{config.event.shortName}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
