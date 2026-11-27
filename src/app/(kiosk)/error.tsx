'use client';

import { ErrorPanel } from '@/components/ErrorPanel';

/** The self check in tablet: tries again by itself, and points guests to the desk. */
export default function KioskError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main id="main" className="grid min-h-dvh place-items-center p-8">
      <ErrorPanel
        reset={reset}
        title="Please check in at the desk"
        message="This tablet lost its connection for a moment. It tries again by itself."
        autoRetryMs={5000}
      />
    </main>
  );
}
