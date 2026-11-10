/**
 * Turns the branding block in config/event.json into CSS variables.
 *
 * The brief says the look and feel is not decided yet and will come from
 * whoever designs the event slides. So no colour is written in a component.
 * Every colour is a token here, and a new theme is a config edit.
 *
 * Light and dark are both always emitted. A page picks one with the
 * data-theme attribute, which is how the projector can run dark while phones
 * run light.
 */
import type { Branding, ThemeTokens } from './event-schema';

export type ThemeName = 'light' | 'dark';

/** CSS variable name for each token, used by globals.css and by Tailwind. */
const TOKEN_VARIABLES: Record<keyof ThemeTokens, string> = {
  background: '--c-background',
  surface: '--c-surface',
  surfaceMuted: '--c-surface-muted',
  border: '--c-border',
  text: '--c-text',
  textMuted: '--c-text-muted',
  primary: '--c-primary',
  primaryText: '--c-primary-text',
  accent: '--c-accent',
  accentText: '--c-accent-text',
  live: '--c-live',
  success: '--c-success',
  warning: '--c-warning',
};

function tokenBlock(tokens: ThemeTokens): string {
  return (Object.keys(TOKEN_VARIABLES) as (keyof ThemeTokens)[])
    .map((key) => `  ${TOKEN_VARIABLES[key]}: ${tokens[key]};`)
    .join('\n');
}

/**
 * Only hex colours and font names reach the page, and both are checked by the
 * schema first, so nothing here can carry CSS or script into the document.
 */
function safeFontStack(value: string): string {
  const cleaned = value.replace(/[^A-Za-z0-9 ,.'"-]/g, '').trim();
  return cleaned.length > 0 ? cleaned : 'Arial, Helvetica, sans-serif';
}

/**
 * The stylesheet injected once in the root layout.
 * Light tokens sit on :root, dark tokens apply when data-theme is "dark".
 *
 * The attribute also works on any element, not only <html>, because CSS
 * variables inherit. That is how the big screen pages run dark inside the
 * same root layout as the light phone pages.
 */
export function buildThemeCss(branding: Branding): string {
  const body = safeFontStack(branding.fontFamily);
  const display = safeFontStack(branding.displayFontFamily ?? branding.fontFamily);

  return [
    ':root {',
    tokenBlock(branding.themes.light),
    `  --brand-primary: ${branding.brand.primary};`,
    `  --brand-navy: ${branding.brand.navy};`,
    `  --brand-panel: ${branding.brand.panel};`,
    `  --font-body: ${body};`,
    `  --font-display: ${display};`,
    '}',
    '[data-theme="light"] {',
    tokenBlock(branding.themes.light),
    '}',
    ':root[data-theme="dark"], [data-theme="dark"] {',
    tokenBlock(branding.themes.dark),
    '}',
    // Paper is white, so anything printed (name tags, the report summary)
    // uses the light colours even when the screen theme is dark.
    '@media print {',
    ':root, :root[data-theme="dark"], [data-theme="dark"] {',
    tokenBlock(branding.themes.light),
    '}',
    '}',
  ].join('\n');
}

/** Which theme a page should start in. */
export function resolveTheme(branding: Branding, surface: 'portal' | 'bigScreen'): ThemeName {
  return surface === 'bigScreen' ? branding.bigScreenTheme : branding.defaultTheme;
}
