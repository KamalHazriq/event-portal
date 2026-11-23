'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { looksLikeBusinessCard } from '../business-card';
import { KIOSK_RESET_MS, kioskMessage, parseScanPayload, type ScanOutcome } from '../logic';
import { useQrScanner } from './useQrScanner';

type Shown = ReturnType<typeof kioskMessage>;

type Candidate = { id: string; name: string; department: string };

/** A card whose name is close to someone on the list, but not exact. */
type Confirm = { cardEmail: string; candidates: Candidate[] };

/** How long the "Are you ...?" question waits before the kiosk resets. */
const CONFIRM_MS = 20_000;

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
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  // Typing your name instead of scanning.
  const [typing, setTyping] = useState(false);
  const [typed, setTyped] = useState('');
  const [matches, setMatches] = useState<Candidate[]>([]);
  const confirmRef = useRef<Confirm | null>(null);
  const confirmTimer = useRef<number | undefined>(undefined);
  const typingRef = useRef(false);
  const busyRef = useRef(false);
  const resetRef = useRef<number | undefined>(undefined);
  const recentRef = useRef<Map<string, number>>(new Map());

  const show = useCallback((next: Shown) => {
    setShown(next);
    window.clearTimeout(resetRef.current);
    resetRef.current = window.setTimeout(() => setShown(null), KIOSK_RESET_MS);
  }, []);

  const ask = useCallback((next: Confirm | null) => {
    confirmRef.current = next;
    setConfirm(next);
    window.clearTimeout(confirmTimer.current);
    if (next) {
      confirmTimer.current = window.setTimeout(() => {
        confirmRef.current = null;
        setConfirm(null);
      }, CONFIRM_MS);
    }
  }, []);

  const send = useCallback(
    async (input: {
      payload?: string;
      attendeeId?: string;
      cardEmail?: string;
      method?: 'qr' | 'manual';
    }) => {
      if (busyRef.current) return;
      busyRef.current = true;
      try {
        const response = await fetch('/api/check-in', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ method: 'qr', ...input, dayId }),
        });
        const body = (await response.json()) as {
          outcome: ScanOutcome;
          attendee?: { name: string };
          card?: { name: string; email: string };
          candidates?: Candidate[];
        };
        // The card is close to someone on the list but not exact: ask them.
        // Only names close to the one on their own card are shown, at most three.
        if (body.outcome === 'choose' && body.candidates && body.candidates.length > 0) {
          ask({
            cardEmail: body.card?.email ?? '',
            candidates: body.candidates.slice(0, 3),
          });
          return;
        }
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
    [ask, dayId, dayLabel, show],
  );

  const pick = useCallback(
    (candidate: Candidate | null) => {
      const current = confirmRef.current;
      ask(null);
      if (!candidate || !current) {
        // Picked from a typed search: let them try again. From a card: the desk.
        if (current && !current.cardEmail) setTyping(true);
        else show(kioskMessage('card-not-found', undefined, dayLabel));
        return;
      }
      void send({
        attendeeId: candidate.id,
        cardEmail: current.cardEmail || undefined,
        method: current.cardEmail ? 'qr' : 'manual',
      });
    },
    [ask, dayLabel, send, show],
  );

  useEffect(() => {
    typingRef.current = typing;
    if (!typing) return;
    // Walked away mid-typing: back to the camera after a while.
    const idle = window.setTimeout(() => {
      setTyping(false);
      setTyped('');
      setMatches([]);
    }, 45_000);
    return () => window.clearTimeout(idle);
  }, [typing, typed]);

  // Names that start the way the person typed: three letters, then a moment's pause.
  useEffect(() => {
    if (!typing) return;
    const text = typed.trim();
    const timer = window.setTimeout(async () => {
      if (text.length < 3) {
        setMatches([]);
        return;
      }
      try {
        const response = await fetch(`/api/attendees/search?kiosk=1&q=${encodeURIComponent(text)}`);
        const body = (await response.json()) as { results?: Candidate[] };
        setMatches(body.results ?? []);
      } catch {
        setMatches([]);
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [typed, typing]);

  const stopTyping = useCallback(() => {
    setTyping(false);
    setTyped('');
    setMatches([]);
  }, []);

  /** A name picked from the typed search: asked "Is this you?" first. */
  const chooseTyped = useCallback(
    (person: Candidate) => {
      stopTyping();
      ask({ cardEmail: '', candidates: [person] });
    },
    [ask, stopTyping],
  );

  const handleScanned = useCallback(
    (raw: string) => {
      // While someone is answering "Are you ...?", ignore the camera.
      if (confirmRef.current) return;
      if (typingRef.current) return;
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
      void send({ payload: value });
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
      window.clearTimeout(confirmTimer.current);
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

      {confirm ? (
        <div
          role="dialog"
          aria-label="Is this you?"
          className="screen-fade w-full max-w-2xl rounded-3xl border-4 border-primary bg-primary/10 p-8"
        >
          <p className="text-[clamp(1.6rem,5vw,3rem)] leading-tight font-bold text-ink">
            {confirm.candidates.length === 1 ? 'Is this you?' : 'Which one is you?'}
          </p>
          <ul className="mt-6 space-y-3">
            {confirm.candidates.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => pick(c)}
                  className="flex min-h-16 w-full flex-col items-center justify-center rounded-2xl bg-primary px-6 py-3 text-on-primary"
                >
                  <span className="text-[clamp(1.3rem,3.6vw,2.2rem)] font-bold">
                    {confirm.candidates.length === 1 ? `Yes, I am ${c.name}` : c.name}
                  </span>
                  {c.department ? (
                    <span className="text-base opacity-90">{c.department}</span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => pick(null)}
            className="mt-4 min-h-14 w-full rounded-2xl border-2 border-line px-6 text-lg font-semibold text-ink"
          >
            {confirm.candidates.length === 1 ? 'No, that is not me' : 'None of these'}
          </button>
        </div>
      ) : typing ? (
        <div className="screen-fade w-full max-w-2xl rounded-3xl border-4 border-primary bg-surface p-8 text-left">
          <label className="block text-[clamp(1.4rem,4vw,2.4rem)] font-bold text-ink">
            Type your name
            <input
              autoFocus
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              autoCapitalize="words"
              spellCheck={false}
              placeholder="The start of your first or last name"
              className="mt-3 block min-h-16 w-full rounded-2xl border-2 border-line bg-canvas px-5 text-[clamp(1.2rem,3vw,1.8rem)] font-semibold text-ink focus:border-primary focus:outline-none"
            />
          </label>
          {typed.trim().length > 0 && typed.trim().length < 3 ? (
            <p className="mt-3 text-lg text-ink-soft">Keep typing: three letters or more.</p>
          ) : typed.trim().length >= 3 && matches.length === 0 ? (
            <p className="mt-3 text-lg text-ink-soft">
              No match yet. Try your other name, or see the registration desk.
            </p>
          ) : null}
          <ul className="mt-4 space-y-2" aria-label="Names that match">
            {matches.map((person) => (
              <li key={person.id}>
                <button
                  type="button"
                  onClick={() => chooseTyped(person)}
                  className="flex min-h-16 w-full items-center justify-between gap-3 rounded-2xl border-2 border-line bg-canvas px-5 py-3 text-left hover:border-primary"
                >
                  <span>
                    <span className="block text-[clamp(1.1rem,2.8vw,1.6rem)] font-bold text-ink">
                      {person.name}
                    </span>
                    {person.department ? (
                      <span className="block text-base text-ink-soft">{person.department}</span>
                    ) : null}
                  </span>
                  <span aria-hidden="true" className="text-2xl text-primary">
                    →
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={stopTyping}
            className="mt-4 min-h-14 w-full rounded-2xl border-2 border-line px-6 text-lg font-semibold text-ink"
          >
            Back to scanning
          </button>
        </div>
      ) : shown ? (
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

      {!typing && !confirm ? (
        <button
          type="button"
          onClick={() => setTyping(true)}
          className="min-h-14 rounded-2xl border-2 border-primary px-6 text-lg font-bold text-ink"
        >
          No card? Type your name
        </button>
      ) : null}
    </div>
  );
}
