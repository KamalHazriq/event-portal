import Link from 'next/link';

import { getEventConfig } from '@/lib/config';
import { pageNowParam } from '@/lib/test-clock-server';
import { resolveEventNow } from '@/lib/time';

/**
 * After the last day, every attendee page says so, once, at the top: the
 * summit is over, thank you, and where the take aways and feedback are.
 */
export async function EventEndedBanner() {
  const config = getEventConfig();
  const now = resolveEventNow({
    timezone: config.event.timezone,
    overrideParam: await pageNowParam(null),
  });
  if (now.date <= config.event.endDate) return null;
  return (
    <aside
      role="status"
      aria-label="The event has ended"
      className="mb-6 rounded-xl border border-line border-l-4 border-l-accent bg-surface p-3 pr-4 text-ink"
    >
      <p className="font-semibold">
        {config.event.shortName} has ended. Thank you for being part of it.
      </p>
      <p className="text-sm text-ink-soft">
        <Link href="/resources" className="font-semibold text-primary">
          Take aways
        </Link>
        {config.features.feedback ? (
          <>
            {' · '}
            <Link href="/feedback/event" className="font-semibold text-primary">
              Tell us how it went
            </Link>
          </>
        ) : null}
      </p>
    </aside>
  );
}
