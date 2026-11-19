import { getEventConfig } from '@/lib/config';
import { resolveTheme } from '@/lib/theme';

/** The kiosk shell: no header or menu, in the big screen theme. */
export default function KioskLayout({ children }: { children: React.ReactNode }) {
  const theme = resolveTheme(getEventConfig().branding, 'bigScreen');
  return (
    <div data-theme={theme} className="min-h-dvh bg-canvas font-sans text-ink">
      {children}
    </div>
  );
}
