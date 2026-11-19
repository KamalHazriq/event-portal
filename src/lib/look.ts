/**
 * The portal's style: how it is set, not what colour it is.
 *
 * The colours always come from the theme in the event config. The style is
 * a separate layer over them: typefaces, corners, rules, depth and the home
 * page's layout.
 *
 * - classic: the first look. Telegraf, glows, lifted cards, the aurora.
 * - ruled: Host Grotesk and Instrument Sans, flat cards outlined in a firm
 *   rule, soft 8 px corners, no glows or shadows, and an editorial home page.
 *
 * The config sets the default; the secretariat can switch it for the whole
 * site from the dashboard (a stored setting), and switch back.
 */
export const STYLES = ['classic', 'ruled'] as const;
export type PortalStyle = (typeof STYLES)[number];

export const STYLE_KEY = 'look.style';

export const STYLE_INFO: Record<PortalStyle, { title: string; description: string }> = {
  classic: {
    title: 'Classic',
    description: 'The original look: soft glows, lifted cards and the moving background.',
  },
  ruled: {
    title: 'Ruled',
    description: 'Clean and editorial: new typefaces, flat outlined cards, no glows.',
  },
};

export function isPortalStyle(value: unknown): value is PortalStyle {
  return typeof value === 'string' && (STYLES as readonly string[]).includes(value);
}

/** The stored choice if it is one we know, else the config's default. */
export function resolveStyle(
  stored: string | null | undefined,
  fallback: PortalStyle,
): PortalStyle {
  return isPortalStyle(stored) ? stored : fallback;
}
