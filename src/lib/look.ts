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
 * - studio: Ruled's pages, with a minimal tech finish: light, tight display
 *   type, square tiles, mono code labels, an accent square on the main
 *   buttons, a glass hexagon and a stats grid on the home page.
 *
 * The config sets the default; the secretariat can switch it for the whole
 * site from the dashboard (a stored setting), and switch back.
 */
export const STYLES = ['classic', 'ruled', 'studio'] as const;
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
  studio: {
    title: 'Studio',
    description:
      'Minimal tech: light large type, square tiles, code labels and a glass hexagon. Built on Ruled.',
  },
};

/** Studio is Ruled underneath: the same pages and layout, with its own finish on top. */
export function usesRuledLayout(style: PortalStyle): boolean {
  return style !== 'classic';
}

/** The base style the stylesheet follows (data-style); Studio adds data-look on top. */
export function baseStyle(style: PortalStyle): 'classic' | 'ruled' {
  return style === 'classic' ? 'classic' : 'ruled';
}

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
