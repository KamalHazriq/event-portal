import type { Metadata, Viewport } from 'next';

import { ConfigErrorScreen } from '@/components/ConfigErrorScreen';
import { SiteHeader } from '@/components/SiteHeader';
import { tryLoadEventConfig } from '@/lib/config';
import { buildThemeCss, resolveTheme } from '@/lib/theme';

import './globals.css';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // The event theme sets the browser chrome colour on a phone.
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#0053A1' },
    { media: '(prefers-color-scheme: dark)', color: '#04121F' },
  ],
};

export async function generateMetadata(): Promise<Metadata> {
  const result = tryLoadEventConfig();
  if (!result.ok) {
    return { title: 'Event portal: configuration problem' };
  }

  const { event } = result.config;
  return {
    title: { default: event.name, template: `%s | ${event.shortName}` },
    description: event.tagline || `${event.name}, ${event.venue}`,
    // Nothing here reaches an external service. No analytics, no tracking.
    robots: { index: false, follow: false },
    applicationName: event.shortName,
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const result = tryLoadEventConfig();

  // A broken config file must not produce a stack trace on a phone in a
  // ballroom. Say what is wrong and how to fix it.
  if (!result.ok) {
    return (
      <html lang="en">
        <body>
          <ConfigErrorScreen error={result.error} />
        </body>
      </html>
    );
  }

  const config = result.config;
  const theme = resolveTheme(config.branding, 'portal');

  return (
    <html lang="en" data-theme={theme}>
      <head>
        {/* Theme tokens from config/event.json. See src/lib/theme.ts. */}
        <style>{buildThemeCss(config.branding)}</style>
      </head>
      <body className="min-h-dvh font-sans antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-on-primary"
        >
          Skip to main content
        </a>

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
          </footer>
        </div>
      </body>
    </html>
  );
}
