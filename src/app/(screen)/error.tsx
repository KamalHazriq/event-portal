'use client';

import { ErrorPanel } from '@/components/ErrorPanel';

/** The projector: nobody is at the keyboard, so it tries again by itself. */
export default function ScreenError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main id="main" className="grid min-h-dvh place-items-center p-8">
      <ErrorPanel
        reset={reset}
        title="One moment"
        message="The screen lost its connection. It tries again by itself every few seconds."
        autoRetryMs={5000}
      />
    </main>
  );
}
