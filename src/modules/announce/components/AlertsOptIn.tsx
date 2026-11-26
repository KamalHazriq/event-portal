'use client';

import { Icon } from '@/components/icons';
import { useEffect, useState, useSyncExternalStore } from 'react';

import { alertSupport, type AlertSupport } from '../logic';

function detect(): AlertSupport {
  const nav = navigator as Navigator & { standalone?: boolean };
  const ios =
    /iPad|iPhone|iPod/.test(nav.userAgent) ||
    (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1);
  return alertSupport({
    serviceWorker: 'serviceWorker' in nav,
    pushManager: 'PushManager' in window,
    notification: 'Notification' in window,
    ios,
    standalone: window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true,
    permission: 'Notification' in window ? Notification.permission : null,
  });
}

const noop = () => () => undefined;

/** The browser wants the key as bytes. */
function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const padded = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4))
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function currentSubscription(): Promise<PushSubscription | null> {
  const reg = await navigator.serviceWorker.getRegistration('/');
  return (await reg?.pushManager.getSubscription()) ?? null;
}

/**
 * "Get event alerts on this device." Explains first, asks the browser only
 * when tapped, and says plainly when a phone cannot (or must be added to
 * the home screen first, on iPhone).
 */
export function AlertsOptIn({ team = false }: { team?: boolean }) {
  const support = useSyncExternalStore(noop, detect, () => 'unknown' as AlertSupport);
  const [on, setOn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');

  useEffect(() => {
    if (support !== 'ready') return;
    currentSubscription()
      .then(async (sub) => {
        if (!sub) return setOn(false);
        if (!team) return setOn(true);
        // Team alerts: the server knows whether this device is a team phone.
        const status = (await (
          await fetch(`/api/push?endpoint=${encodeURIComponent(sub.endpoint)}`)
        ).json()) as { team?: boolean };
        setOn(status.team === true);
      })
      .catch(() => setOn(false));
  }, [support, team]);

  async function turnOn() {
    setBusy(true);
    setProblem('');
    try {
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      await navigator.serviceWorker.ready;
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setProblem('Alerts were not allowed. You can change this in the browser settings.');
        return;
      }
      const { publicKey } = (await (await fetch('/api/push')).json()) as { publicKey: string };
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: keyBytes(publicKey),
        }));
      const response = await fetch('/api/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...sub.toJSON(), ...(team ? { team: true } : {}) }),
      });
      if (!response.ok) throw new Error('save failed');
      setOn(true);
    } catch {
      setProblem('Alerts could not be turned on. Try again in a moment.');
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    try {
      const sub = await currentSubscription();
      if (sub) {
        await fetch('/api/push', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint, ...(team ? { team: true } : {}) }),
        });
        // Turning team alerts off leaves the phone's ordinary alerts alone.
        if (!team) await sub.unsubscribe();
      }
      setOn(false);
    } finally {
      setBusy(false);
    }
  }

  if (support === 'unknown' || support === 'unsupported') return null;

  if (support === 'install-first') {
    return (
      <section aria-label="Event alerts" className="rounded-xl border border-line bg-surface p-4">
        <p className="font-bold text-ink">Want event alerts on your iPhone?</p>
        <p className="mt-1 text-sm text-ink-soft">
          Tap Share, then Add to Home Screen. Open the portal from the new icon and turn alerts on
          there.
        </p>
      </section>
    );
  }

  if (support === 'blocked') {
    return (
      <p className="text-sm text-ink-soft">
        Event alerts are blocked for this site in your browser settings.
      </p>
    );
  }

  if (on) {
    return (
      <p className="flex flex-wrap items-center gap-2 text-sm text-ink-soft" role="status">
        <Icon name="bell" className="mr-1 inline size-4 align-text-bottom" />
        {team ? 'Team alerts are on for this device.' : 'Event alerts are on for this device.'}
        <button
          type="button"
          onClick={() => void turnOff()}
          disabled={busy}
          className="min-h-11 font-semibold text-ink underline underline-offset-2"
        >
          Turn off
        </button>
      </p>
    );
  }

  return (
    <section aria-label="Event alerts" className="rounded-xl border border-line bg-surface p-4">
      <p className="font-bold text-ink">
        <Icon name="bell" className="mr-1 inline size-4 align-text-bottom" />
        {team ? 'Get team alerts on this device' : 'Get event alerts on this device'}
      </p>
      <p className="mt-1 text-sm text-ink-soft">
        {team
          ? 'For the secretariat: set-up reminders, photos and comments waiting, and messages sent to the team only. Attendees never get these.'
          : 'Bus times, room changes and the lucky draw, as a notification. No sign up, and you can turn them off any time.'}
      </p>
      <button
        type="button"
        onClick={() => void turnOn()}
        disabled={busy || on === null}
        className="mt-3 inline-flex min-h-11 items-center rounded-lg bg-primary px-4 font-bold text-on-primary disabled:opacity-60"
      >
        {busy ? 'Turning on…' : team ? 'Turn on team alerts' : 'Turn on alerts'}
      </button>
      {problem ? (
        <p role="alert" className="mt-2 text-sm font-semibold text-warning">
          {problem}
        </p>
      ) : null}
    </section>
  );
}
