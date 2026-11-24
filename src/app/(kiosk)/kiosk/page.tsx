import type { Metadata } from 'next';
import Link from 'next/link';

import { requireAdmin } from '@/lib/admin-guard';
import { getEventConfig } from '@/lib/config';
import { resolveEventNow } from '@/lib/time';
import { KioskConsole } from '@/modules/check-in/components/KioskConsole';
import { checkInDays, resolveCheckInDay } from '@/modules/check-in/logic';
import { giftView, loadDoorGifts } from '@/modules/door-gift/server';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Self check in' };

/**
 * The self check in kiosk. Opened on a tablet signed in at the desk, then
 * left on a stand. No menus, so there is nowhere else to go from it.
 */
export default async function KioskPage() {
  await requireAdmin('/kiosk');
  const config = getEventConfig();
  const now = resolveEventNow({ timezone: config.event.timezone });
  const day = resolveCheckInDay(checkInDays(config), now);
  const gifts = await loadDoorGifts();
  if (!day) return <p className="p-6 text-ink">This event has no days set up yet.</p>;
  return (
    <main id="main" className="relative bg-canvas">
      {config.branding.organisationLogoPath ? (
        <span className="absolute top-4 left-4 inline-flex rounded-lg bg-white px-3 py-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={config.branding.organisationLogoPath}
            alt={config.branding.organisationName || 'Organiser logo'}
            className="block h-8 w-auto"
          />
        </span>
      ) : null}
      <KioskConsole
        dayId={day.id}
        dayLabel={day.label}
        eventName={config.event.shortName}
        guestItems={gifts.open ? gifts.config.items.map(giftView) : []}
      />
      {/* A quiet way out for staff: it asks for the PIN if the tablet is locked. */}
      <Link
        href="/admin"
        className="absolute right-4 bottom-4 text-xs text-ink-soft opacity-50 no-underline hover:opacity-100"
      >
        Secretariat
      </Link>
    </main>
  );
}
