'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Re-renders the page on a timer so the "happening now" highlight keeps up
 * with the clock.
 *
 * Short polling, not websockets, per brief hard rule 7: it works behind any
 * corporate proxy. Sixty seconds is right for a phone, where the only thing
 * that changes is which session is highlighted, and it keeps data use and
 * battery drain low on hotel Wi-Fi. The big screen pages (Module 8)
 * poll every 4 seconds, which is what live counters need.
 */
export function AutoRefresh({
  intervalMs = 60_000,
  /** Switched off while a dev time override is in force, so it stays put. */
  enabled = true,
}: {
  intervalMs?: number;
  enabled?: boolean;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) return;

    const tick = () => {
      // No point refreshing a page nobody is looking at.
      if (document.visibilityState === 'visible') router.refresh();
    };

    const timer = window.setInterval(tick, intervalMs);
    // Catch up straight away when someone comes back to the tab.
    document.addEventListener('visibilitychange', tick);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [enabled, intervalMs, router]);

  return null;
}
