import Link from 'next/link';

import { SiteHeader } from '@/components/SiteHeader';
import { getEventConfig } from '@/lib/config';
import { markFor, resolveTheme } from '@/lib/theme';

/** The shell every attendee page sits in. */
export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const config = getEventConfig();
  const { branding } = config;
  const theme = resolveTheme(branding, 'portal');

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col lg:max-w-6xl">
      <SiteHeader event={config.event} features={config.features} mark={markFor(branding, theme)} />

      <main
        id="main"
        // Pages keep a comfortable reading width; the home page and the guide
        // opt out to use a wide screen. See their root class names.
        className="flex-1 px-4 pb-16 pt-5 sm:px-6 lg:px-8 [&>*]:mx-auto [&>*]:w-full [&>*]:max-w-3xl"
      >
        {children}
      </main>

      <footer className="border-t border-line px-4 py-6 text-sm text-ink-soft sm:px-6 lg:px-8">
        {branding.organisationLogoPath ? (
          // On a white tile, since organiser logos are usually made for white.
          <div className="mb-4 inline-flex rounded-lg bg-white px-3 py-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={branding.organisationLogoPath}
              alt={branding.organisationName || 'Organiser logo'}
              className="h-8 w-auto"
            />
          </div>
        ) : null}
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
