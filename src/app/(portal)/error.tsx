'use client';

import { ErrorPanel } from '@/components/ErrorPanel';

export default function PortalError({ reset }: { error: Error; reset: () => void }) {
  return <ErrorPanel reset={reset} />;
}
