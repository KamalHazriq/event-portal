'use client';

import { useEffect, useState } from 'react';

type Status = 'online' | 'offline' | 'back';

/**
 * Says so when the phone loses the Wi-Fi, instead of leaving buttons that
 * seem to do nothing. Offline, pages already opened still read, and a form
 * (comment, question, vote, feedback) is held back with its text kept, rather
 * than the browser throwing the page away. When the connection returns, a
 * short "back online" and the form can be sent.
 */
export function ConnectionBanner() {
  const [status, setStatus] = useState<Status>('online');
  const [blocked, setBlocked] = useState(false);
  const [wasBlocked, setWasBlocked] = useState(false);

  useEffect(() => {
    let timer: number | undefined;
    const down = () => setStatus('offline');
    const up = () => {
      setStatus('back');
      setBlocked((b) => {
        if (b) setWasBlocked(true);
        return false;
      });
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        setStatus('online');
        setWasBlocked(false);
      }, 4000);
    };
    // Held back while offline: the text stays in the box.
    const submit = (event: Event) => {
      if (navigator.onLine) return;
      const form = event.target as HTMLFormElement | null;
      if (!form || (form.method ?? '').toLowerCase() !== 'post') return;
      event.preventDefault();
      event.stopPropagation();
      setBlocked(true);
    };
    const initial = window.setTimeout(() => {
      if (!navigator.onLine) down();
    }, 0);
    window.addEventListener('offline', down);
    window.addEventListener('online', up);
    document.addEventListener('submit', submit, true);
    return () => {
      window.clearTimeout(initial);
      window.clearTimeout(timer);
      window.removeEventListener('offline', down);
      window.removeEventListener('online', up);
      document.removeEventListener('submit', submit, true);
    };
  }, []);

  // The page-wide "you are offline" bar is OfflineSupport's. This one speaks only when a
  // form was held back, and once more when the connection returns after that.
  if (!blocked && !(status === 'back' && wasBlocked)) return null;
  const offline = status === 'offline';

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-50 mx-auto max-w-xl lg:bottom-3 rounded-xl border px-4 py-3 text-sm font-semibold shadow-lg print:hidden ${
        offline ? 'border-warning bg-canvas text-ink' : 'border-success bg-canvas text-success'
      }`}
    >
      {offline
        ? 'Nothing was sent: you are offline. Your text is still in the box. Press send again when the Wi-Fi is back.'
        : 'Back online. You can send now.'}
    </div>
  );
}
