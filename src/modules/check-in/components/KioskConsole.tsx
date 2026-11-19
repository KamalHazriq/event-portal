'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { looksLikeBusinessCard } from '../business-card';
import { KIOSK_RESET_MS, kioskMessage, parseScanPayload, type ScanOutcome } from '../logic';
import { useQrScanner } from './useQrScanner';

type Shown = ReturnType<typeof kioskMessage>;

/**
 * Self check in: a tablet on a stand at the entrance, front camera facing
 * the queue. People hold up the business card in their TNB app (or a name
 * tag QR) and get a big welcome. Anything unsure sends them to the desk.
 * Nothing on screen lists other people.
 */
export function KioskConsole({
  dayId,
  dayLabel,
  eventName,
}: {
  dayId: string;
  dayLabel: string;
  eventName: string;
}) {
  const [shown, setShown] = useState<Shown | null>(null);
  const busyRef = useRef(false);
  const resetRef = useRef<number | undefined>(undefined);
  const recentRef = useRef<Map<string, number>>(new Map());

  const show = useCallback((next: Shown) => {
    setShown(next);
    window.clearTimeout(resetRef.current);
    resetRef.current = window.setTimeout(() => setShown(null), KIOSK_RESET_MS);
  }, []);

  const send = useCallback(
    async (payload: string) => {
      if (busyRef.current) return;
      busyRef.current = true;
      try {
        const response = await fetch('/api/check-in', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ payload, method: 'qr', dayId }),
        });
        const body = (await response.json()) as {
          outcome: ScanOutcome;
          attendee?: { name: string };
        };
        show(kioskMessage(body.outcome, body.attendee?.name, dayLabel));
        try {
          navigator.vibrate?.(body.outcome === 'checked-in' ? 40 : [60, 50, 60]);
        } catch {
          // Not every tablet vibrates.
        }
      } catch {
        show(kioskMessage('error', undefined, dayLabel));
      } finally {
        busyRef.current = false;
      }
    },
    [dayId, dayLabel, show],
  );

  const handleScanned = useCallback(
    (raw: string) => {
      const value = looksLikeBusinessCard(raw) ? raw : parseScanPayload(raw);
      if (!value) {
        show(kioskMessage('unreadable', undefined, dayLabel));
        return;
      }
      // The same card held up for a few seconds counts once.
      const now = Date.now();
      for (const [key, at] of recentRef.current) {
        if (now - at > KIOSK_RESET_MS) recentRef.current.delete(key);
      }
      if (recentRef.current.has(value)) return;
      recentRef.current.set(value, now);
      void send(value);
    },
    [dayLabel, send, show],
  );

  const { videoRef, canvasRef, cameraOn, cameraError, startCamera } = useQrScanner(
    handleScanned,
    'user',
  );

  // Start straight away, and keep the tablet awake while it stands there.
  useEffect(() => {
    void startCamera();
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & {
      wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> };
    };
    nav.wakeLock
      ?.request('screen')
      .then((l) => {
        lock = l;
      })
      .catch(() => undefined);
    return () => {
      void lock?.release().catch(() => undefined);
      window.clearTimeout(resetRef.current);
    };
  }, [startCamera]);

  const tone =
    shown?.tone === 'good'
      ? 'border-success bg-success/15'
      : shown?.tone === 'again'
        ? 'border-warning bg-warning/15'
        : 'border-live bg-live/15';

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 p-6 text-center">
      <p className="text-sm font-semibold tracking-[0.14em] text-ink-soft uppercase">
        {eventName} · {dayLabel}
      </p>

      {shown ? (
        <div
          role="status"
          aria-live="assertive"
          className={`screen-fade w-full max-w-2xl rounded-3xl border-4 p-10 ${tone}`}
        >
          <p className="text-[clamp(2.2rem,7vw,4.5rem)] leading-tight font-bold text-ink">
            {shown.title}
          </p>
          <p className="mt-3 text-[clamp(1.1rem,3vw,1.8rem)] text-ink">{shown.detail}</p>
        </div>
      ) : (
        <div>
          <h1 className="text-[clamp(2rem,6vw,4rem)] leading-tight font-bold text-ink">
            Check yourself in
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-[clamp(1.1rem,3vw,1.6rem)] text-ink-soft">
            Open the business card in your TNB app and hold it up to the camera.
          </p>
        </div>
      )}

      <div className={`w-full max-w-md ${shown ? 'opacity-40' : ''}`}>
        <video
          ref={videoRef}
          playsInline
          muted
          // Mirrored, so moving the phone feels natural.
          className={`aspect-video w-full -scale-x-100 rounded-2xl bg-black object-cover ${
            cameraOn ? '' : 'hidden'
          }`}
        />
        <canvas ref={canvasRef} className="hidden" />
        {!cameraOn ? (
          <button
            type="button"
            onClick={() => void startCamera()}
            className="min-h-14 rounded-xl bg-primary px-6 text-lg font-bold text-on-primary"
          >
            Start the camera
          </button>
        ) : null}
        {cameraError ? (
          <p role="alert" className="mt-2 font-semibold text-warning">
            {cameraError}
          </p>
        ) : null}
      </div>

      <p className="text-ink-soft">No card? The registration desk will check you in by name.</p>
    </div>
  );
}
