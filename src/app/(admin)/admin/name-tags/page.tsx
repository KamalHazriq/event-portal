import type { Metadata } from 'next';
import Link from 'next/link';

import { QrCode } from '@/components/QrCode';
import { getData } from '@/data';
import { requireAdmin } from '@/lib/admin-guard';
import { getEventConfig } from '@/lib/config';
import { departmentWithShort } from '@/lib/departments';
import { passLink } from '@/lib/event-pass-server';
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
 * Printable name tags. Two designs, chosen by nameTags.personalQr in the
 * event config:
 *
 * - Off (the default): one sided. Name, title, department and the portal QR,
 *   the same for everyone. Check in is by the digital business card in the
 *   TNB app, or by name at the desk. One print run, nothing to line up.
 * - On: front with the personal check in QR, back with the portal QR.
 *
 * The portal QR carries the event pass, so a scan lets people straight in.
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
  const personalQr = config.nameTags.personalQr;
  const side = personalQr && first(params.side) === 'back' ? 'back' : 'front';
  const includeSecretariat = first(params.include) !== 'attendees';
  const blue = first(params.design) === 'blue';

  const data = getData();
  const everyone = await data.attendees.list();
  const people = includeSecretariat ? everyone : everyone.filter((person) => !person.isSecretariat);

  const portalUrl = config.event.portalUrl;
  const portalQr = passLink(portalUrl);

  // The organiser's logo: the white version on the blue card, else the
  // normal one. With no white version the blue card gets it on a white chip.
  const { organisationLogoPath, organisationLogoDarkPath, organisationName } = config.branding;
  const logo = blue ? (organisationLogoDarkPath ?? organisationLogoPath) : organisationLogoPath;
  const logoNeedsChip = blue && !organisationLogoDarkPath;
  const logoAlt = organisationName || 'Organiser logo';

  /** A link to this page with some options changed and the rest kept. */
  const href = (over: { side?: string; include?: string; design?: string }) => {
    const query = new URLSearchParams({
      side: over.side ?? side,
      include: over.include ?? (includeSecretariat ? 'all' : 'attendees'),
      design: over.design ?? (blue ? 'blue' : 'white'),
    });
    return `/admin/name-tags?${query.toString()}`;
  };

  return (
    <div className="space-y-5">
      <div className="print:hidden">
        <header>
          <h1 className="text-2xl font-bold text-ink">Name tags</h1>
          <p className="mt-1 text-ink-soft">
            {people.length} tags
            {personalQr ? `, ${side === 'front' ? 'fronts' : 'backs'}` : ', one sided'}. Print, then
            use your browser&apos;s Save as PDF if you want a file.
          </p>
        </header>

        <section className="mt-3 rounded-lg border border-line bg-surface p-4">
          <h2 className="font-bold text-ink">Before you print</h2>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-ink">
            {personalQr ? (
              <li>Print the fronts, then put the same sheets back in and print the backs.</li>
            ) : (
              <li>
                One side only. The QR opens the portal; check in is with the business card in the
                TNB app, or by name at the desk.
              </li>
            )}
            <li>
              In the print dialog, set margins to None and turn off headers and footers, or the tags
              will not line up.
            </li>
            <li>Check one page before printing all {people.length}.</li>
            {blue ? (
              <li>
                The blue card prints a full colour background: tick &quot;Background graphics&quot;
                in the print dialog, and expect it to use more ink than the white one.
              </li>
            ) : null}
            {personalQr ? (
              <li>
                Each front carries that person&apos;s own code. Do not photocopy a sheet, or two
                people end up with the same tag.
              </li>
            ) : null}
          </ol>
        </section>

        <nav className="mt-3 flex flex-wrap gap-2" aria-label="Name tag options">
          {(
            [
              ['white', 'White card'],
              ['blue', 'Blue card'],
            ] as const
          ).map(([design, label]) => (
            <Link
              key={design}
              href={href({ design })}
              aria-current={(design === 'blue') === blue ? 'page' : undefined}
              className={`rounded-lg border px-3 py-2 text-sm no-underline ${
                (design === 'blue') === blue
                  ? 'border-primary bg-primary font-bold text-on-primary'
                  : 'border-line bg-surface font-semibold text-ink'
              }`}
            >
              {label}
            </Link>
          ))}
          {personalQr ? (
            <>
              {(
                [
                  ['front', 'Fronts'],
                  ['back', 'Backs'],
                ] as const
              ).map(([value, label]) => (
                <Link
                  key={value}
                  href={href({ side: value })}
                  aria-current={side === value ? 'page' : undefined}
                  className={`rounded-lg border px-3 py-2 text-sm no-underline ${
                    side === value
                      ? 'border-primary bg-primary font-bold text-on-primary'
                      : 'border-line bg-surface font-semibold text-ink'
                  }`}
                >
                  {label}
                </Link>
              ))}
            </>
          ) : null}
          <Link
            href={href({ include: includeSecretariat ? 'attendees' : 'all' })}
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
          <div key={person.id} className={`tag ${blue ? 'tag-blue' : ''}`}>
            {side === 'front' ? (
              <>
                <div className="tag-text">
                  {personalQr ? null : <p className="tag-event">{config.event.shortName}</p>}
                  <p className={`tag-name ${person.name.length > 28 ? 'tag-name-long' : ''}`}>
                    {person.name}
                  </p>
                  {person.title ? <p className="tag-title">{person.title}</p> : null}
                  {person.department ? (
                    <p className="tag-dept">{departmentWithShort(config, person.department)}</p>
                  ) : null}
                </div>
                <div className="tag-side">
                  {logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={logo}
                      alt={logoAlt}
                      className={`tag-logo ${logoNeedsChip ? 'rounded bg-white p-1' : ''}`}
                    />
                  ) : null}
                  {personalQr ? (
                    <QrCode
                      value={buildCheckInUrl(portalUrl, person.checkInToken)}
                      label={`Check in code for ${person.name}`}
                      className="tag-qr"
                    />
                  ) : (
                    <>
                      <QrCode value={portalQr} label="Event portal" className="tag-qr" />
                      <p className="tag-qr-caption">Agenda</p>
                    </>
                  )}
                </div>
              </>
            ) : (
              <div className="tag-back">
                {logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logo}
                    alt={logoAlt}
                    className={`tag-logo ${logoNeedsChip ? 'rounded bg-white p-1' : ''}`}
                  />
                ) : null}
                <QrCode value={portalQr} label="Event portal" className="tag-qr-back" />
                <p className="tag-back-label tag-qr-caption">Agenda</p>
                <p className="tag-back-event">{config.event.shortName}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
