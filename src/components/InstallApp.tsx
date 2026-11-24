'use client';

import { useState, useSyncExternalStore } from 'react';

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
/** Where the Share button is: bottom centre in Safari on an iPhone, top right elsewhere. */
function sharePosition(): 'bottom' | 'top' {
  const ua = navigator.userAgent;
  const otherBrowser = /CriOS|FxiOS|EdgiOS/.test(ua);
  const iPad =
    /iPad/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return otherBrowser || iPad ? 'top' : 'bottom';
}

export function InstallApp({ className = '' }: { className?: string }) {
  const state = useSyncExternalStore<InstallState>(
    subscribeInstall,
    installSnapshot,
    () => 'unknown',
  );
  const [pointing, setPointing] = useState(false);

  if (state === 'unknown' || state === 'unavailable' || state === 'installed') return null;

  if (state === 'samsung-steps' || state === 'android-steps') {
    const samsung = state === 'samsung-steps';
    return (
      <section
        aria-label="Add to home screen"
        className={`rounded-xl border border-line bg-surface p-4 ${className}`}
      >
        <p className="font-bold text-ink">Put it on your home screen</p>
        <p className="mt-1 text-sm text-ink-soft">
          {samsung
            ? 'In Samsung Internet it takes three taps:'
            : 'Your browser has no install button here, so use its menu:'}
        </p>
        <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-sm text-ink-soft">
          {samsung ? (
            <>
              <li>
                Tap the <strong className="text-ink">menu</strong> (☰, three lines, at the bottom
                right or top right).
              </li>
              <li>
                Choose <strong className="text-ink">Add page to</strong>, then{' '}
                <strong className="text-ink">Home screen</strong>, then Add.
              </li>
            </>
          ) : (
            <>
              <li>
                Tap the <strong className="text-ink">menu</strong> (⋮, three dots, at the top
                right).
              </li>
              <li>
                Choose <strong className="text-ink">Install app</strong> or{' '}
                <strong className="text-ink">Add to Home screen</strong>.
              </li>
            </>
          )}
          <li>Open it from the new icon. Already there? Just open it from the icon.</li>
        </ol>
      </section>
    );
  }

  if (state === 'ios-steps') {
    const top = sharePosition() === 'top';
    return (
      <section
        aria-label="Add to home screen"
        className={`rounded-xl border border-line bg-surface p-4 ${className}`}
      >
        <p className="font-bold text-ink">Put it on your home screen</p>
        <p className="mt-1 text-sm text-ink-soft">
          Apple does not allow an install button, so it takes three taps:
        </p>
        <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-sm text-ink-soft">
          <li>
            Tap the <strong className="text-ink">Share</strong> button (the square with an arrow
            {top ? ', at the top right' : ', in the bar at the bottom'}).
          </li>
          <li>
            Scroll and choose <strong className="text-ink">Add to Home Screen</strong>, then Add.
          </li>
          <li>Open the app from its new icon. This is also needed for alerts on an iPhone.</li>
        </ol>
        <button
          type="button"
          onClick={() => setPointing(true)}
          className="mt-3 min-h-11 rounded-lg border border-line px-4 font-semibold text-ink"
        >
          Show me where Share is
        </button>

        {pointing ? (
          <div
            role="dialog"
            aria-label="Where to tap"
            className={`fixed z-50 flex flex-col items-center gap-1 ${
              top ? 'top-2 right-3 items-end' : 'inset-x-0 bottom-2'
            }`}
          >
            {top ? (
              <span aria-hidden="true" className="animate-bounce pr-4 text-4xl text-primary">
                ↗
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => setPointing(false)}
              className="rounded-xl bg-primary px-4 py-3 text-center font-bold text-on-primary shadow-lg"
            >
              Tap Share, then Add to Home Screen
              <span className="block text-sm font-normal opacity-90">Tap here to hide this</span>
            </button>
            {top ? null : (
              <span aria-hidden="true" className="animate-bounce text-4xl text-primary">
                ↓
              </span>
            )}
          </div>
        ) : null}
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
