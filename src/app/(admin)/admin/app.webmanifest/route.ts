import { NextResponse } from 'next/server';

import { tryLoadEventConfig } from '@/lib/config';
import { resolveTheme } from '@/lib/theme';

export const dynamic = 'force-dynamic';

/**
 * The secretariat app: its own icon and name, opening at /admin. Holds only
 * the event name and colours, like the attendee manifest, so it is open.
 */
export function GET() {
  const result = tryLoadEventConfig();
  const base = { id: '/admin', start_url: '/admin', scope: '/admin', display: 'standalone' };
  if (!result.ok) {
    return NextResponse.json({ name: 'Secretariat', ...base });
  }
  const { event, branding } = result.config;
  const colours = branding.themes[resolveTheme(branding, 'portal')];
  return NextResponse.json(
    {
      name: `${event.shortName} Secretariat`,
      short_name: 'Secretariat',
      description: `The secretariat desk for ${event.name}`,
      ...base,
      background_color: colours.background,
      theme_color: colours.background,
      icons: [
        { src: '/branding/d-icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/branding/d-icon-512.png', sizes: '512x512', type: 'image/png' },
      ],
    },
    { headers: { 'Content-Type': 'application/manifest+json' } },
  );
}
