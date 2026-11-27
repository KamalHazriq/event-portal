'use client';

import { ErrorPanel } from '@/components/ErrorPanel';

export default function AdminError({ reset }: { error: Error; reset: () => void }) {
  return (
    <ErrorPanel
      reset={reset}
      message="This page did not load, usually a passing connection problem. Nothing you saved is lost."
    >
      <p className="mt-2 text-sm text-ink-soft">
        At the desk, check ins made while the connection was down are kept on this device and sent
        when it is back.
      </p>
    </ErrorPanel>
  );
}
