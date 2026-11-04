import type { Metadata } from 'next';
import Link from 'next/link';

import { getData } from '@/data';
import { getAdminSession } from '@/lib/admin-guard';
import { getEventConfig } from '@/lib/config';
import { formatShortDate, resolveEventNow } from '@/lib/time';
import { parseScanPayload, resolveCheckInDay } from '@/modules/check-in/logic';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Check in' };

/**
 * Where a name tag QR code leads.
 *
 * Any phone camera can open this, which is the point: the desk does not have
 * to use our scanner if something goes wrong with it.
 *
 * It only checks someone in when a secretariat session is signed in on the
 * device. An attendee who scans their own tag out of curiosity is told to
 * show it at the desk instead, so arrivals always mean someone actually
 * turned up and collected their tag.
 */
export default async function CheckInLandingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token: raw } = await params;
  const config = getEventConfig();
  const session = await getAdminSession();

  const token = parseScanPayload(raw);

  if (!session) {
    return (
      <div className="space-y-4 py-6">
        <h1 className="text-2xl font-bold text-ink">Please show this at the desk</h1>
        <p className="text-ink">
          This code is on the front of your name tag. The registration desk scans it when you
          arrive, so there is nothing for you to do here.
        </p>
        <Link
          href="/"
          className="inline-flex min-h-11 items-center rounded-lg bg-primary px-4 py-2.5 font-bold text-on-primary no-underline"
        >
          Open the event portal
        </Link>
      </div>
    );
  }

  const now = resolveEventNow({ timezone: config.event.timezone });
  const day = resolveCheckInDay(config.days, now);

  if (!token || !day) {
    return <Outcome heading="That code did not read" detail="Try the desk scanner instead." />;
  }

  const data = getData();
  const attendee = await data.attendees.findByCheckInToken(token);

  if (!attendee) {
    return (
      <Outcome
        heading="Tag not recognised"
        detail="This tag is not on the attendee list. Search for the person by name at the desk."
      />
    );
  }

  const { alreadyCheckedIn } = await data.checkIns.create({
    attendeeId: attendee.id,
    dayId: day.id,
    method: 'qr',
    byOperator: session.operator,
  });

  return (
    <div className="space-y-4 py-6">
      <p
        className={[
          'rounded-lg border-2 p-3 text-lg font-bold text-ink',
          alreadyCheckedIn ? 'border-warning bg-warning/10' : 'border-success bg-success/10',
        ].join(' ')}
      >
        {alreadyCheckedIn ? 'Already checked in' : 'Checked in'}
      </p>

      <div>
        <p className="text-3xl font-bold leading-tight text-ink">{attendee.name}</p>
        <p className="text-ink-soft">
          {[attendee.title, attendee.department].filter(Boolean).join(', ')}
        </p>
        {attendee.remark ? (
          <p className="mt-2 inline-block rounded bg-warning/20 px-2 py-1 font-semibold text-ink">
            {attendee.remark}
          </p>
        ) : null}
      </div>

      <p className="text-sm text-ink-soft">
        {day.label}, {formatShortDate(day.date, config.event.timezone)}
      </p>

      <Link
        href="/admin/desk"
        className="inline-flex min-h-11 items-center rounded-lg bg-primary px-4 py-2.5 font-bold text-on-primary no-underline"
      >
        Back to the desk
      </Link>
    </div>
  );
}

function Outcome({ heading, detail }: { heading: string; detail: string }) {
  return (
    <div className="space-y-4 py-6">
      <h1 className="text-2xl font-bold text-ink">{heading}</h1>
      <p className="text-ink">{detail}</p>
      <Link
        href="/admin/desk"
        className="inline-flex min-h-11 items-center rounded-lg bg-primary px-4 py-2.5 font-bold text-on-primary no-underline"
      >
        Back to the desk
      </Link>
    </div>
  );
}
