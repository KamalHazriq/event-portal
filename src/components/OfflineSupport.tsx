'use client';

import { useEffect, useSyncExternalStore } from 'react';

function subscribe(onChange: () => void): () => void {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

/**
 * Registers the service worker (so pages keep a copy for patchy Wi-Fi, and
 * alerts can arrive), and says so plainly when the phone is offline.
 */
export function OfflineSupport() {
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => undefined);
  }, []);

  if (online) return null;
  return (
    <div
      role="status"
      className="sticky top-0 z-50 bg-warning px-4 py-2 text-center text-sm font-semibold text-canvas"
    >
      You are offline. Showing the last copy saved on this phone.
    </div>
  );
}
