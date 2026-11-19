/**
 * Spotting links that are still placeholders in the event config, so the
 * portal shows "coming soon" instead of sending people to a dead page, and
 * the secretariat sees what is left to fill in.
 */
const PLACEHOLDER_HOSTS = ['example.com', 'example.org', 'example.net', 'example.invalid'];

export function isPlaceholderUrl(url: string | null | undefined): boolean {
  if (!url) return true;
  if (/REPLACE|TODO|TBC|TBA/i.test(url)) return true;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return PLACEHOLDER_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return true;
  }
}

/** Text that still says it is waiting for a decision. */
export function looksUnconfirmed(text: string | null | undefined): boolean {
  return /\b(to confirm|tbc|tba|to be confirmed|placeholder)\b/i.test(text ?? '');
}
