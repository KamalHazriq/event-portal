import type { MetadataRoute } from 'next';

import { tryLoadEventConfig } from '@/lib/config';
import { resolveTheme } from '@/lib/theme';

/**
 * Lets people "Add to Home Screen": the portal then opens full screen from
 * an icon, like an app, straight to the agenda. Everything comes from the
 * event config, so another event gets its own name and colours.
 */
export const dynamic = 'force-dynamic';

export default function manifest(): MetadataRoute.Manifest {
  const result = tryLoadEventConfig();
  if (!result.ok) return { name: 'Event portal', start_url: '/', display: 'standalone' };
  const { event, branding } = result.config;
  const colours = branding.themes[resolveTheme(branding, 'portal')];
  return {
    name: event.name,
    short_name: event.shortName,
    description: event.tagline || `${event.name}, ${event.venue}`,
    id: '/',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: colours.background,
    theme_color: colours.background,
    icons: [
      { src: '/branding/d-icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/branding/d-icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
