import type { Metadata } from 'next';
import { encode } from 'uqr';

import { QrCode } from '@/components/QrCode';
import { requireAdmin } from '@/lib/admin-guard';
import { getEventConfig } from '@/lib/config';
import { displayUrl } from '@/lib/event-pass';
import { eventPass, passLink } from '@/lib/event-pass-server';
import { QrDownload } from '@/modules/check-in/components/QrDownload';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'QR assets' };

/**
 * Everything printable that carries the portal QR code: table tents for the
 * ballroom, and a file to drop into the welcome slide.
 *
 * All of it points at event.portalUrl, the one address behind every QR code
 * at this event.
 */
export default async function QrAssetsPage() {
  await requireAdmin('/admin/qr-assets');

  const config = getEventConfig();
  const portalUrl = config.event.portalUrl;
  // What the QR codes hold: the address plus the event pass, when there is
  // one, so a scan lets people straight in. The printed text leaves it out.
  const qrUrl = passLink(portalUrl);
  const hasPass = qrUrl !== portalUrl;
  const isPlaceholder = portalUrl.includes('example.com') || portalUrl.includes('example.invalid');

  // Worked out here so the browser never needs a QR library.
  const encoded = encode(qrUrl, { ecc: 'M', border: 2 });
  const rows = encoded.data.map((row) => row.map((filled) => (filled ? '1' : '0')).join(''));

  const tentCount = 12;

  return (
    <div className="space-y-5">
      <div className="space-y-5 print:hidden">
        <header>
          <h1 className="text-2xl font-bold text-ink">QR assets</h1>
          <p className="mt-1 text-ink-soft">
            Everything that points people at the portal. One address, one code, everywhere.
          </p>
        </header>

        {isPlaceholder ? (
          <p className="rounded-lg border-2 border-warning bg-warning/10 p-3 font-semibold text-ink">
            The portal address is still the placeholder. Set event.portalUrl in config/event.json
            before printing or sharing any of this.
          </p>
        ) : null}

        <section className="rounded-xl border border-line bg-surface p-4">
          <h2 className="font-bold text-ink">The portal address</h2>
          <p className="mt-1 break-all font-mono text-sm text-ink">{portalUrl}</p>

          <div className="mt-3 flex flex-wrap items-center gap-4">
            <QrCode value={qrUrl} label="Event portal" className="size-32" />
            <QrDownload rows={rows} filename="portal-qr" label="Event portal" />
          </div>

          {hasPass ? (
            <p className="mt-3 rounded-lg border border-line bg-muted p-3 text-sm text-ink">
              The portal is for participants only. These QR codes carry the event code, so scanning
              one lets people straight in. Anyone without a code sees a page asking for it. Share
              the codes only with participants.
              <span className="mt-2 block">
                Event code, for anyone whose camera will not scan:{' '}
                <span className="font-mono font-bold tracking-widest">{eventPass()}</span>
              </span>
            </p>
          ) : null}

          <p className="mt-3 text-sm text-ink-soft">
            This same code goes on the back of every name tag, on the welcome slide, on the table
            tents and in the calendar invite.
          </p>
        </section>

        <section className="rounded-xl border border-line bg-surface p-4">
          <h2 className="font-bold text-ink">Table tents</h2>
          <p className="mt-1 text-sm text-ink-soft">
            {tentCount} tents below, one per page, A5 landscape. Print on A4 and fold, or print
            straight onto A5 card. Set margins to None in the print dialog.
          </p>
          <p className="mt-3 rounded-lg border border-line bg-muted p-3 text-sm text-ink">
            Press <span className="font-mono font-bold">Ctrl</span> and{' '}
            <span className="font-mono font-bold">P</span> to print. Everything above this point is
            left off the paper.
          </p>
        </section>
      </div>

      <div className="tent-sheet">
        {Array.from({ length: tentCount }, (_, index) => (
          <div key={index} className="tent">
            <div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={config.branding.logoPath}
                alt={config.event.shortName}
                className="tent-logo"
              />
              <p className="tent-line">Scan for the agenda, speakers and resources</p>
              <p className="tent-url">{displayUrl(portalUrl)}</p>
            </div>
            <QrCode value={qrUrl} label="Event portal" className="tent-qr" />
          </div>
        ))}
      </div>
    </div>
  );
}
