'use client';

/**
 * "Install the app". Chrome and Edge (Android and desktop) offer an install
 * prompt through the beforeinstallprompt event, fired once per page load. It
 * is kept here so a button anywhere on the page can use it. Safari on an
 * iPhone has no such prompt, so people there are shown the steps instead.
 */
type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

let deferred: InstallEvent | null = null;
let installed = false;
let listening = false;
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

/** Starts listening once. Safe to call from every component that needs it. */
export function listenForInstall(): void {
  if (listening || typeof window === 'undefined') return;
  listening = true;
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault(); // Our button is the prompt, not the browser's mini bar.
    deferred = event as InstallEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    installed = true;
    notify();
  });
}

export function subscribeInstall(onChange: () => void): () => void {
  listenForInstall();
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

export type InstallState =
  | 'unknown'
  | 'installed'
  | 'can-prompt'
  | 'ios-steps'
  | 'samsung-steps'
  | 'android-steps'
  | 'unavailable';

function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true;
}

function isIos(): boolean {
  const nav = navigator as Navigator & { maxTouchPoints?: number };
  return (
    /iPad|iPhone|iPod/.test(nav.userAgent) ||
    (nav.platform === 'MacIntel' && (nav.maxTouchPoints ?? 0) > 1)
  );
}

/** What to show, as a short string so React can compare snapshots cheaply. */
export function installSnapshot(): InstallState {
  if (installed || isStandalone()) return 'installed';
  if (deferred) return 'can-prompt';
  if (isIos()) return 'ios-steps';
  // Android with no prompt: Samsung Internet never offers one, and Chrome stays
  // quiet when the app is already installed. Show the menu steps instead.
  const ua = navigator.userAgent;
  if (/SamsungBrowser/i.test(ua)) return 'samsung-steps';
  if (/Android/i.test(ua)) return 'android-steps';
  return 'unavailable';
}

/** Asks the browser to install. Resolves true if the person accepted. */
export async function promptInstall(): Promise<boolean> {
  const event = deferred;
  if (!event) return false;
  await event.prompt();
  const choice = await event.userChoice;
  deferred = null;
  notify();
  return choice.outcome === 'accepted';
}
