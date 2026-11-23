import { NextResponse } from 'next/server';

import { tryLoadEventConfig } from '@/lib/config';
import { resolveTheme } from '@/lib/theme';

/**
 * A manifest for one part of the portal that installs as its own app: the
 * secretariat, the projector screen, the check in kiosk. Holds only the
 * event name and colours, so it is open like the attendee manifest.
 */
export function appManifest(options: {
  path: string;
  title: string;
  short: string;
  about: string;
  display: 'standalone' | 'fullscreen';
  /** Icon file names without the size, like d-icon or d-icon-admin. */
  icon?: string;
}): NextResponse {
  const result = tryLoadEventConfig();
  const base = {
    id: options.path,
    start_url: options.path,
    scope: options.path,
    display: options.display,
  };
  const headers = { 'Content-Type': 'application/manifest+json' };
  if (!result.ok) return NextResponse.json({ name: options.title, ...base }, { headers });
  const { event, branding } = result.config;
  const colours = branding.themes[resolveTheme(branding, 'portal')];
  return NextResponse.json(
    {
      name: `${event.shortName} ${options.title}`,
      short_name: options.short,
      description: `${options.about} for ${event.name}`,
      ...base,
      background_color: colours.background,
      theme_color: colours.background,
      icons: [
        {
          src: `/branding/${options.icon ?? 'd-icon'}-192.png`,
          sizes: '192x192',
          type: 'image/png',
        },
        {
          src: `/branding/${options.icon ?? 'd-icon'}-512.png`,
          sizes: '512x512',
          type: 'image/png',
        },
      ],
    },
    { headers },
  );
}
