/** Reads the active style: the secretariat's choice, else the config default. */
import { getData } from '@/data';
import { tryLoadEventConfig } from '@/lib/config';
import { resolveStyle, STYLE_KEY, type PortalStyle } from '@/lib/look';

export async function readStyle(): Promise<PortalStyle> {
  const result = tryLoadEventConfig();
  const fallback = result.ok ? result.config.branding.style : 'classic';
  try {
    return resolveStyle(await getData().settings.get(STYLE_KEY), fallback);
  } catch {
    // No database (the static schedule preview) or a passing hiccup: the
    // config's default still gives a finished page.
    return fallback;
  }
}
