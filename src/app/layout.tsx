import type { Metadata, Viewport } from 'next';

import { ConfigErrorScreen } from '@/components/ConfigErrorScreen';
import { FormLoader } from '@/components/FormLoader';
import { tryLoadEventConfig } from '@/lib/config';
import { refreshConfigOverlay } from '@/lib/config-sync';
import { refreshScheduleDelay } from '@/lib/schedule-delay';
import { buildThemeCss, markFor, resolveTheme } from '@/lib/theme';

// The Ruled style's typefaces, bundled with the site (nothing loads from an
// outside service). A browser only downloads them when a page uses them.
import '@fontsource-variable/host-grotesk';
import '@fontsource-variable/instrument-sans';
import { readStyle } from '@/modules/look/server';

import './globals.css';

/**
 * The root layout holds only what every page needs: the document, the theme
 * tokens and the skip link.
 *
 * The chrome lives one level down, because the attendee pages and the
 * secretariat pages need different chrome. See (portal)/layout.tsx and
 * (admin)/layout.tsx. Route groups do not change any URL.
 */

/** The browser bar takes the theme's own background, from config. */
export function generateViewport(): Viewport {
  const result = tryLoadEventConfig();
  const base: Viewport = { width: 'device-width', initialScale: 1 };
  if (!result.ok) return base;
  const { branding } = result.config;
  return { ...base, themeColor: branding.themes[resolveTheme(branding, 'portal')].background };
}

export async function generateMetadata(): Promise<Metadata> {
  const result = tryLoadEventConfig();
  if (!result.ok) {
    return { title: 'Event portal: configuration problem' };
  }

  const { event, branding } = result.config;
  return {
    // The favicon.ico in public/ covers old browsers; these cover the rest.
    icons: {
      icon: [
        { url: '/favicon.ico', sizes: 'any' },
        ...(branding.iconPath ? [{ url: branding.iconPath, type: 'image/png' }] : []),
      ],
      apple: branding.appleIconPath ? [{ url: branding.appleIconPath }] : [],
    },
    title: { default: event.name, template: `%s | ${event.shortName}` },
    description: event.tagline || `${event.name}, ${event.venue}`,
    // Nothing here reaches an external service. No analytics, no tracking.
    robots: { index: false, follow: false },
    applicationName: event.shortName,
  };
}

/** CSS variables with the logo mark, safely quoted. */
function markCss(mark: string | null, darkMark: string | null): string {
  const url = (path: string | null) =>
    path && /^\/[\w./-]+$/.test(path) ? `url("${path}")` : 'none';
  return `:root{--brand-mark:${url(mark)};--brand-mark-dark:${url(darkMark ?? mark)};}`;
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Pick up edits saved on the secretariat pages (at most one quick read
  // every two seconds), before anything below reads the config.
  await refreshConfigOverlay();
  await refreshScheduleDelay();
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
  // The style layer over the colours: see src/lib/look.ts.
  const style = await readStyle();

  return (
    <html lang="en" data-theme={theme} data-style={style}>
      <head>
        {/* Theme tokens from config/event.json. See src/lib/theme.ts. */}
        <style>{buildThemeCss(config.branding)}</style>
        {/* The logo mark, for the hexagon loader and the big screen wipe. */}
        <style>{markCss(markFor(config.branding, theme), markFor(config.branding, 'dark'))}</style>
      </head>
      <body className="min-h-dvh font-sans antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-on-primary"
        >
          Skip to main content
        </a>
        {children}
        <FormLoader />
      </body>
    </html>
  );
}
