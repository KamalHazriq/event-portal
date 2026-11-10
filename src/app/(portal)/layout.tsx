import Link from 'next/link';

import { SiteHeader } from '@/components/SiteHeader';
import { getEventConfig } from '@/lib/config';

/** The shell every attendee page sits in. */
export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const config = getEventConfig();

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col">
      <SiteHeader event={config.event} features={config.features} />

      <main id="main" className="flex-1 px-4 pb-16 pt-5">
        {children}
      </main>

      <footer className="border-t border-line px-4 py-6 text-sm text-ink-soft">
        <p className="font-semibold text-ink">{config.event.name}</p>
        <p>
          {config.event.venue}
          {config.event.city ? `, ${config.event.city}` : ''}
        </p>
        {config.event.helpText ? <p className="mt-2">{config.event.helpText}</p> : null}
        <p className="mt-2">
          <Link href="/guide" className="text-ink-soft">
            How this portal works
          </Link>
        </p>
      </footer>
    </div>
  );
}
