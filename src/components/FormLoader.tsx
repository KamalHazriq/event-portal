'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

import { HexLoader } from './HexLoader';

/** Gives up after this long, so a stalled request never traps the screen. */
const FAILSAFE_MS = 10_000;

/**
 * A full screen hexagon loader for forms that leave the page: signing in,
 * entering the event code, picking your name. Mark a form with
 * data-loader="Signing in" and it shows from the moment it is sent until the
 * next page arrives. It fades in after a beat, so a fast answer shows nothing.
 */
function Overlay() {
  // What was sent, and the address it was sent from.
  const [wait, setWait] = useState<{ label: string; at: string } | null>(null);
  const here = `${usePathname()}?${useSearchParams().toString()}`;
  // A new page (or the same page with a new address) means the wait is over.
  const label = wait && wait.at === here ? wait.label : null;

  useEffect(() => {
    const onSubmit = (event: SubmitEvent) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      const text = form.dataset.loader ?? (event.submitter as HTMLElement | null)?.dataset.loader;
      if (!text) return;
      // Let the browser's own checks (required fields) and other handlers run first.
      window.setTimeout(() => {
        if (!event.defaultPrevented) {
          setWait({
            label: text,
            at: `${window.location.pathname}?${window.location.search.slice(1)}`,
          });
        }
      }, 0);
    };
    // Back and forward restore a page from memory: never come back to a spinner.
    const onShow = () => setWait(null);
    document.addEventListener('submit', onSubmit);
    window.addEventListener('pageshow', onShow);
    return () => {
      document.removeEventListener('submit', onSubmit);
      window.removeEventListener('pageshow', onShow);
    };
  }, []);

  useEffect(() => {
    if (!label) return;
    const timer = window.setTimeout(() => setWait(null), FAILSAFE_MS);
    return () => window.clearTimeout(timer);
  }, [label]);

  if (!label) return null;
  return (
    <div className="hex-overlay fixed inset-0 z-[100] flex items-center justify-center bg-canvas/95">
      <HexLoader label={label} />
    </div>
  );
}

export function FormLoader() {
  return (
    <Suspense fallback={null}>
      <Overlay />
    </Suspense>
  );
}
