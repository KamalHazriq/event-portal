import { getEventConfig } from '@/lib/config';
import { resolveTheme } from '@/lib/theme';

/**
 * The projector shell. No header, no navigation, nothing to click: just the
 * view, filling the screen in the big screen theme from config (dark by
 * default, while phones stay light).
 */
export default function ScreenLayout({ children }: { children: React.ReactNode }) {
  const config = getEventConfig();
  const theme = resolveTheme(config.branding, 'bigScreen');

  return (
    <div data-theme={theme} className="min-h-dvh bg-canvas font-sans text-ink">
      {children}
    </div>
  );
}
