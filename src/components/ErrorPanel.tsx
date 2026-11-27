'use client';

import Link from 'next/link';
import { useEffect } from 'react';

/**
 * What a page shows when something fails on the server, such as a database
 * hiccup on hotel Wi-Fi: a plain sentence and a way to try again, instead of
 * the framework's bare "Application error".
 */
export function ErrorPanel({
  reset,
  title = 'Something went wrong',
  message = 'This page did not load. It is usually a passing connection problem.',
  autoRetryMs,
  children,
}: {
  reset: () => void;
  title?: string;
  message?: string;
  /** Try again by itself after this long, for screens nobody is touching. */
  autoRetryMs?: number;
  children?: React.ReactNode;
}) {
  useEffect(() => {
    if (!autoRetryMs) return;
    const timer = window.setTimeout(reset, autoRetryMs);
    return () => window.clearTimeout(timer);
  }, [autoRetryMs, reset]);

  return (
    <section
      role="alert"
      className="mx-auto my-10 max-w-xl rounded-2xl border border-line bg-surface p-6"
    >
      <h1 className="text-2xl font-bold text-ink">{title}</h1>
      <p className="mt-2 text-ink-soft">{message}</p>
      {children}
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={reset}
          className="min-h-11 rounded-lg bg-primary px-5 font-bold text-on-primary"
        >
          Try again
        </button>
        <Link
          href="/"
          className="inline-flex min-h-11 items-center rounded-lg border border-line px-5 font-semibold text-ink no-underline"
        >
          Go to the home page
        </Link>
      </div>
    </section>
  );
}
