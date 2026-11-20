'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  clockState,
  describeOffset,
  latencyState,
  median,
  summarise,
  type CheckResult,
  type CheckState,
} from '../logic';

const BADGE: Record<CheckState, { text: string; cls: string }> = {
  good: { text: 'OK', cls: 'bg-green-100 text-green-900' },
  warn: { text: 'Check', cls: 'bg-amber-100 text-amber-900' },
  bad: { text: 'Fix', cls: 'bg-red-100 text-red-900' },
  info: { text: 'Info', cls: 'bg-surface-muted text-ink' },
};

async function runChecks(): Promise<CheckResult[]> {
  const out: CheckResult[] = [];
  const add = (id: string, label: string, state: CheckState, detail: string) =>
    out.push({ id, label, state, detail });

  const secure = window.isSecureContext;
  add(
    'secure',
    'Secure connection',
    secure ? 'good' : 'bad',
    secure
      ? 'The address is https, so the camera and alerts can work.'
      : 'Not https. The camera and alerts will not work. Use the real portal address.',
  );

  // Speed and clock: a few round trips to the portal.
  try {
    const times: number[] = [];
    let offset = 0;
    for (let i = 0; i < 4; i++) {
      const start = performance.now();
      const res = await fetch('/api/time', { cache: 'no-store' });
      const end = performance.now();
      const body = (await res.json()) as { now: number };
      times.push(end - start);
      offset = Date.now() - (body.now + (end - start) / 2);
    }
    const ms = median(times);
    add('latency', 'Speed to the portal', latencyState(ms), `${ms} ms for a round trip.`);
    add('clock', 'Clock', clockState(offset), describeOffset(offset));
  } catch {
    add('latency', 'Speed to the portal', 'bad', 'The portal did not answer. Check the Wi-Fi.');
  }

  add(
    'online',
    'Network',
    navigator.onLine ? 'good' : 'bad',
    navigator.onLine ? 'Online.' : 'This device says it is offline.',
  );

  // Camera: ask, then stop at once. The Scan page shows the live picture.
  if (!navigator.mediaDevices?.getUserMedia) {
    add('camera', 'Camera', 'bad', 'This browser cannot use a camera here.');
  } else {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      const label = stream.getVideoTracks()[0]?.label || 'a camera';
      stream.getTracks().forEach((t) => t.stop());
      add('camera', 'Camera', 'good', `Allowed (${label}).`);
    } catch (error) {
      const name = (error as DOMException).name;
      add(
        'camera',
        'Camera',
        name === 'NotFoundError' ? 'bad' : 'warn',
        name === 'NotAllowedError'
          ? 'Blocked. Allow the camera for this site in the browser settings.'
          : name === 'NotFoundError'
            ? 'No camera found on this device.'
            : `Could not start (${name}).`,
      );
    }
  }

  add(
    'qr',
    'QR reading',
    'BarcodeDetector' in window ? 'good' : 'info',
    'BarcodeDetector' in window
      ? 'Built in to this browser, so scanning is fast.'
      : 'Not built in. The portal uses its own reader, which is fine but a little slower.',
  );

  // Alerts.
  const hasPush = 'serviceWorker' in navigator && 'PushManager' in window;
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const iPhone = /iPhone|iPad|iPod/.test(navigator.userAgent);
  if (!hasPush) {
    add(
      'push',
      'Alerts',
      iPhone && !standalone ? 'warn' : 'bad',
      iPhone && !standalone
        ? 'On an iPhone alerts only work once the portal is added to the Home Screen. Tap Share, then Add to Home Screen, then open it from there.'
        : 'This browser does not support alerts.',
    );
  } else {
    const permission = 'Notification' in window ? Notification.permission : 'denied';
    let subscribed = false;
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      subscribed = !!(await reg?.pushManager.getSubscription());
    } catch {
      subscribed = false;
    }
    add(
      'push',
      'Alerts',
      permission === 'denied' ? 'bad' : subscribed ? 'good' : 'warn',
      permission === 'denied'
        ? 'Blocked. Allow notifications for this site in the browser settings.'
        : subscribed
          ? 'On for this device.'
          : 'Possible, but not turned on yet. Use Turn on alerts on the Announce page.',
    );
  }

  add(
    'installed',
    'Home screen app',
    standalone ? 'good' : 'info',
    standalone ? 'Running as an installed app.' : 'Running in the browser, not installed.',
  );

  add(
    'wake',
    'Keep screen awake',
    'wakeLock' in navigator ? 'good' : 'warn',
    'wakeLock' in navigator
      ? 'Supported, so the projector and kiosk can stay on.'
      : 'Not supported. Turn off screen sleep in the device settings for the kiosk and projector.',
  );

  add(
    'fullscreen',
    'Full screen',
    document.fullscreenEnabled ? 'good' : 'info',
    document.fullscreenEnabled
      ? 'Available. On a laptop press F11 for the projector.'
      : 'Not available here (normal on an iPhone).',
  );

  try {
    localStorage.setItem('ep-check', '1');
    localStorage.removeItem('ep-check');
    add('storage', 'Saved ticks', 'good', 'This device can keep the Test plan ticks.');
  } catch {
    add(
      'storage',
      'Saved ticks',
      'warn',
      'Storage is blocked (private window?). Ticks will not stay.',
    );
  }

  add(
    'screen',
    'Screen',
    'info',
    `${window.screen.width} x ${window.screen.height}, window ${window.innerWidth} x ${window.innerHeight}, pixel ratio ${window.devicePixelRatio}.`,
  );
  add('agent', 'Browser', 'info', navigator.userAgent);
  return out;
}

export function DeviceCheck() {
  const [results, setResults] = useState<CheckResult[] | null>(null);
  const [running, setRunning] = useState(false);
  const [copied, setCopied] = useState(false);
  const started = useRef(false);

  const run = useCallback(async () => {
    setRunning(true);
    setCopied(false);
    try {
      setResults(await runChecks());
    } finally {
      setRunning(false);
    }
  }, []);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void run();
  }, [run]);

  async function copy() {
    if (!results) return;
    try {
      await navigator.clipboard.writeText(summarise(results));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => void run()}
          disabled={running}
          className="min-h-11 rounded-lg bg-primary px-5 font-bold text-on-primary disabled:opacity-60"
        >
          {running ? 'Checking…' : 'Check again'}
        </button>
        <button
          type="button"
          onClick={() => void copy()}
          disabled={!results}
          className="min-h-11 rounded-lg border border-line px-5 font-semibold text-ink disabled:opacity-60"
        >
          {copied ? 'Copied' : 'Copy the results'}
        </button>
      </div>
      <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
        {(results ?? []).map((r) => (
          <li key={r.id} className="flex items-start gap-3 p-3">
            <span
              className={`mt-0.5 inline-flex min-w-14 justify-center rounded-full px-2 py-0.5 text-xs font-bold ${BADGE[r.state].cls}`}
            >
              {BADGE[r.state].text}
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-ink">{r.label}</p>
              <p className="break-words text-sm text-ink-soft">{r.detail}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
