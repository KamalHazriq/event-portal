'use client';

import { useSyncExternalStore } from 'react';

import {
  installSnapshot,
  promptInstall,
  subscribeInstall,
  type InstallState,
} from '@/lib/install-prompt';

/**
 * A button to put the portal on the home screen, so it opens full screen
 * like an app (and, on an iPhone, so alerts can work at all). Shows the
 * real install prompt where the browser has one, the steps on an iPhone,
 * and nothing where neither applies or it is already installed.
 */
export function InstallApp({ className = '' }: { className?: string }) {
  const state = useSyncExternalStore<InstallState>(
    subscribeInstall,
    installSnapshot,
    () => 'unknown',
  );

  if (state === 'unknown' || state === 'unavailable' || state === 'installed') return null;

  if (state === 'ios-steps') {
    return (
      <section
        aria-label="Add to home screen"
        className={`rounded-xl border border-line bg-surface p-4 ${className}`}
      >
        <p className="font-bold text-ink">Put it on your home screen</p>
        <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-sm text-ink-soft">
          <li>
            Tap the <strong className="text-ink">Share</strong> button in Safari (the square with an
            arrow).
          </li>
          <li>
            Choose <strong className="text-ink">Add to Home Screen</strong>, then Add.
          </li>
          <li>Open the app from its new icon. This is also needed for alerts on an iPhone.</li>
        </ol>
      </section>
    );
  }

  return (
    <section
      aria-label="Install the app"
      className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface p-4 ${className}`}
    >
      <p className="min-w-0 flex-1 text-ink">
        <span className="font-bold">Install the app.</span>{' '}
        <span className="text-ink-soft">
          One tap to open it, full screen, from your home screen.
        </span>
      </p>
      <button
        type="button"
        onClick={() => void promptInstall()}
        className="min-h-11 rounded-lg bg-primary px-5 font-bold text-on-primary"
      >
        Install
      </button>
    </section>
  );
}
