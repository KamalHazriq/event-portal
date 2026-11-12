'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { looksLikeBusinessCard } from '../business-card';
import { parseScanPayload, scanOutcomeMessage, type ScanOutcome } from '../logic';

/**
 * The registration desk.
 *
 * Three ways in, because at a desk with a queue the thing that matters is
 * that something always works:
 *
 *  1. The camera, scanning continuously. Fastest.
 *  2. A text box, which is also where a hardware barcode scanner types.
 *  3. Search by name, for a lost or unreadable tag.
 *
 * The camera uses the browser's own BarcodeDetector where it exists, which is
 * most Android phones and Chrome. Only when it does not is a decoder
 * downloaded, so the common case costs nothing.
 */

type DeskAttendee = {
  id: string;
  name: string;
  title: string;
  department: string;
  remark: string;
  isSecretariat: boolean;
};

type SearchResult = DeskAttendee & {
  staffNo: string;
  checkedIn: boolean;
  checkedInAt: string | null;
};

type Rate = { arrived: number; expected: number; percent: number; remaining: number };

type Result = {
  outcome: ScanOutcome;
  message: string;
  attendee?: DeskAttendee;
  /** From a scanned business card: who it says it is. */
  card?: { name: string; email: string };
  /** When a card's name is close to more than one person, or not exact. */
  candidates?: DeskAttendee[];
};

/** Ignore the same tag for this long, so one tag held up does not spam. */
const REPEAT_WINDOW_MS = 4000;

/** How often the counter catches up with other desks. */
const POLL_MS = 5000;

type BarcodeDetectorLike = {
  detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]>;
};

export function DeskConsole({
  dayId,
  dayLabel,
  initialHeadcount,
}: {
  dayId: string;
  dayLabel: string;
  initialHeadcount: Rate;
}) {
  const [headcount, setHeadcount] = useState<Rate>(initialHeadcount);
  const [result, setResult] = useState<Result | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchMessage, setSearchMessage] = useState('');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recentRef = useRef<Map<string, number>>(new Map());
  const manualRef = useRef<HTMLInputElement | null>(null);

  /* ----------------------------------------------------------- feedback */

  // A short beep, built in the browser, so there is no sound file to load.
  const beep = useCallback((ok: boolean) => {
    try {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      const context = new Ctor();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = ok ? 880 : 220;
      gain.gain.value = 0.07;
      oscillator.connect(gain).connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.12);
      window.setTimeout(() => void context.close(), 300);
    } catch {
      // Sound is a nicety. Never let it break a check in.
    }
    try {
      navigator.vibrate?.(ok ? 40 : [60, 50, 60]);
    } catch {
      // Same.
    }
  }, []);

  /* ---------------------------------------------------------- check in */

  const sendCheckIn = useCallback(
    async (input: {
      payload?: string;
      attendeeId?: string;
      cardEmail?: string;
      method: 'qr' | 'manual';
    }) => {
      setBusy(true);
      try {
        const response = await fetch('/api/check-in', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...input, dayId }),
        });
        const body = (await response.json()) as Result & { headcount?: Rate };

        setResult({
          outcome: body.outcome,
          message: body.message,
          attendee: body.attendee,
          card: body.card,
          candidates: body.candidates,
        });
        if (body.headcount) setHeadcount(body.headcount);
        // Not on the list: start the name search for the desk.
        if (body.outcome === 'card-not-found' && body.card?.name) setQuery(body.card.name);
        beep(body.outcome === 'checked-in');

        // Refresh the search list so it stops saying someone is not in yet.
        if (body.outcome === 'checked-in' && searchResults.length > 0) {
          setSearchResults((rows) =>
            rows.map((row) => (row.id === body.attendee?.id ? { ...row, checkedIn: true } : row)),
          );
        }
      } catch {
        setResult({ outcome: 'error', message: scanOutcomeMessage('error') });
        beep(false);
      } finally {
        setBusy(false);
      }
    },
    [beep, dayId, searchResults.length],
  );

  /** Drops repeats of a tag that is still sitting in front of the camera. */
  const seenRecently = useCallback((token: string): boolean => {
    const now = Date.now();
    const seen = recentRef.current;
    for (const [key, at] of seen) {
      if (now - at > REPEAT_WINDOW_MS) seen.delete(key);
    }
    if (seen.has(token)) return true;
    seen.set(token, now);
    return false;
  }, []);

  const handleScanned = useCallback(
    (raw: string) => {
      // The digital business card in the TNB app. The server reads it and
      // matches it on email or name.
      if (looksLikeBusinessCard(raw)) {
        if (seenRecently(raw)) return;
        void sendCheckIn({ payload: raw, method: 'qr' });
        return;
      }
      const token = parseScanPayload(raw);
      if (!token) {
        setResult({ outcome: 'unreadable', message: scanOutcomeMessage('unreadable') });
        return;
      }
      if (seenRecently(token)) return;
      void sendCheckIn({ payload: token, method: 'qr' });
    },
    [seenRecently, sendCheckIn],
  );

  /* ------------------------------------------------------------ camera */

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraOn(false);
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraOn(true);
    } catch {
      setCameraError(
        'The camera could not start. Check the browser has permission, or use the box below.',
      );
      setCameraOn(false);
    }
  }, []);

  // Always let go of the camera when leaving the page.
  useEffect(() => () => stopCamera(), [stopCamera]);

  // The scanning loop.
  useEffect(() => {
    if (!cameraOn) return;

    let stopped = false;
    let frame = 0;
    let detector: BarcodeDetectorLike | null = null;
    let decodeFallback: typeof import('jsqr').default | null = null;

    const setup = async () => {
      const maybe = (
        window as unknown as {
          BarcodeDetector?: new (options: { formats: string[] }) => BarcodeDetectorLike;
        }
      ).BarcodeDetector;

      if (maybe) {
        try {
          detector = new maybe({ formats: ['qr_code'] });
          return;
        } catch {
          detector = null;
        }
      }
      // Only downloaded when the browser cannot do it itself.
      decodeFallback = (await import('jsqr')).default;
    };

    const tick = async () => {
      if (stopped) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        const width = video.videoWidth;
        const height = video.videoHeight;

        if (width > 0 && height > 0) {
          try {
            if (detector) {
              const found = await detector.detect(video);
              const value = found[0]?.rawValue;
              if (value) handleScanned(value);
            } else if (decodeFallback) {
              canvas.width = width;
              canvas.height = height;
              const context = canvas.getContext('2d', { willReadFrequently: true });
              if (context) {
                context.drawImage(video, 0, 0, width, height);
                const image = context.getImageData(0, 0, width, height);
                const found = decodeFallback(image.data, width, height);
                if (found?.data) handleScanned(found.data);
              }
            }
          } catch {
            // A single bad frame is not worth stopping the scanner for.
          }
        }
      }

      if (!stopped) frame = window.setTimeout(tick, 220) as unknown as number;
    };

    void setup().then(() => {
      if (!stopped) void tick();
    });

    return () => {
      stopped = true;
      window.clearTimeout(frame);
    };
  }, [cameraOn, handleScanned]);

  /* ------------------------------------------------- counter and search */

  useEffect(() => {
    const poll = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const response = await fetch(`/api/headcount?dayId=${encodeURIComponent(dayId)}`);
        if (!response.ok) return;
        const body = (await response.json()) as { total?: Rate };
        if (body.total) setHeadcount(body.total);
      } catch {
        // The desk keeps working with a slightly stale number.
      }
    };
    const timer = window.setInterval(poll, POLL_MS);
    return () => window.clearInterval(timer);
  }, [dayId]);

  const runSearch = useCallback(
    async (text: string) => {
      if (text.trim().length < 2) {
        setSearchResults([]);
        setSearchMessage('');
        return;
      }
      try {
        const response = await fetch(
          `/api/attendees/search?q=${encodeURIComponent(text)}&dayId=${encodeURIComponent(dayId)}`,
        );
        const body = (await response.json()) as { results: SearchResult[]; message: string };
        setSearchResults(body.results ?? []);
        setSearchMessage(body.message ?? '');
      } catch {
        setSearchMessage('Search did not work. Try again.');
      }
    },
    [dayId],
  );

  // Wait for a pause in typing rather than searching on every keystroke.
  useEffect(() => {
    const timer = window.setTimeout(() => void runSearch(query), 250);
    return () => window.clearTimeout(timer);
  }, [query, runSearch]);

  /* -------------------------------------------------------------- view */

  const tone =
    result?.outcome === 'checked-in'
      ? 'border-success bg-success/10'
      : result?.outcome === 'already-checked-in' || result?.outcome === 'choose'
        ? 'border-warning bg-warning/10'
        : result
          ? 'border-live bg-live/10'
          : 'border-line bg-surface';

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-line bg-surface p-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
              {dayLabel} arrivals
            </p>
            <p className="text-4xl font-bold tabular-nums leading-none text-ink">
              {headcount.arrived}
              <span className="text-2xl font-normal text-ink-soft"> / {headcount.expected}</span>
            </p>
          </div>
          <p className="text-sm text-ink-soft">{headcount.remaining} to go</p>
        </div>
        <div
          className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={headcount.percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Arrivals so far"
        >
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-500"
            style={{ width: `${headcount.percent}%` }}
          />
        </div>
      </section>

      {/* The result of the last scan, deliberately large and loud. */}
      <section aria-live="polite" className={`rounded-xl border-2 p-4 ${tone}`}>
        {result ? (
          <>
            <p className="text-lg font-bold text-ink">{result.message}</p>
            {result.attendee ? (
              <>
                <p className="mt-1 text-2xl font-bold leading-tight text-ink">
                  {result.attendee.name}
                </p>
                <p className="text-ink-soft">
                  {[result.attendee.title, result.attendee.department].filter(Boolean).join(', ')}
                </p>
                {result.attendee.remark ? (
                  <p className="mt-2 inline-block rounded bg-warning/20 px-2 py-1 text-sm font-semibold text-ink">
                    {result.attendee.remark}
                  </p>
                ) : null}
              </>
            ) : null}
            {result.card && !result.attendee ? (
              <p className="mt-1 text-ink">
                The card says: <span className="font-bold">{result.card.name || 'no name'}</span>
              </p>
            ) : null}
            {result.outcome === 'card-not-found' ? (
              <p className="mt-1 text-sm text-ink-soft">
                Search below. The name is filled in for you.
              </p>
            ) : null}
            {result.outcome === 'choose' && result.candidates ? (
              <ul className="mt-3 space-y-2">
                {result.candidates.map((person) => (
                  <li
                    key={person.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-surface p-3"
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-ink">{person.name}</p>
                      <p className="text-sm text-ink-soft">
                        {[person.title, person.department].filter(Boolean).join(', ')}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void sendCheckIn({
                          attendeeId: person.id,
                          cardEmail: result.card?.email || undefined,
                          method: 'qr',
                        })
                      }
                      className="min-h-11 shrink-0 rounded-lg bg-primary px-4 py-2 font-bold text-on-primary disabled:opacity-60"
                    >
                      This is them
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        ) : (
          <p className="text-ink-soft">
            Scan a name tag or the business card in the TNB app, or search for a name below.
          </p>
        )}
      </section>

      {/* Side by side on a laptop: scanning on the left, searching on the right. */}
      <div className="grid gap-4 xl:grid-cols-2 xl:items-start">
        <section className="rounded-xl border border-line bg-surface p-4">
          <h2 className="font-bold text-ink">Scan</h2>

          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => (cameraOn ? stopCamera() : void startCamera())}
              className="min-h-11 rounded-lg bg-primary px-4 py-2 font-bold text-on-primary"
            >
              {cameraOn ? 'Stop the camera' : 'Use the camera'}
            </button>
            <button
              type="button"
              onClick={() => manualRef.current?.focus()}
              className="min-h-11 rounded-lg border border-line px-4 py-2 font-semibold text-ink"
            >
              Type a code
            </button>
          </div>

          {cameraError ? (
            <p role="alert" className="mt-2 text-sm font-semibold text-warning">
              {cameraError}
            </p>
          ) : null}

          <div className={cameraOn ? 'mt-3' : 'hidden'}>
            <video
              ref={videoRef}
              playsInline
              muted
              className="aspect-video w-full rounded-lg bg-black object-cover"
            />
            <canvas ref={canvasRef} className="hidden" />
            <p className="mt-1 text-sm text-ink-soft">
              Hold the name tag, or the phone showing the business card, in the picture. Ask people
              to turn their screen brightness up. It checks people in as it reads them.
            </p>
          </div>

          <form
            className="mt-3"
            onSubmit={(event) => {
              event.preventDefault();
              const value = manualRef.current?.value ?? '';
              if (value.trim().length > 0) {
                handleScanned(value);
                if (manualRef.current) manualRef.current.value = '';
              }
            }}
          >
            <label htmlFor="manual-code" className="block text-sm font-semibold text-ink">
              Or scan with a handheld scanner, or type the code
            </label>
            <input
              id="manual-code"
              ref={manualRef}
              type="text"
              autoComplete="off"
              spellCheck={false}
              className="mt-1 min-h-11 w-full rounded-lg border border-line bg-canvas px-3 py-2 font-mono text-ink"
            />
          </form>
        </section>

        <section className="rounded-xl border border-line bg-surface p-4">
          <h2 className="font-bold text-ink">Search by name</h2>
          <p className="text-sm text-ink-soft">For a lost tag or a code that will not read.</p>

          <label htmlFor="desk-search" className="sr-only">
            Search for a name or staff number
          </label>
          <input
            id="desk-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Name or staff number"
            className="mt-2 min-h-11 w-full rounded-lg border border-line bg-canvas px-3 py-2 text-ink"
          />

          {searchMessage ? <p className="mt-2 text-sm text-ink-soft">{searchMessage}</p> : null}

          {searchResults.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {searchResults.map((person) => (
                <li
                  key={person.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line p-3"
                >
                  <div className="min-w-0">
                    <p className="font-bold text-ink">{person.name}</p>
                    <p className="text-sm text-ink-soft">
                      {[person.title, person.department].filter(Boolean).join(', ')}
                    </p>
                    {person.remark ? (
                      <p className="text-sm font-semibold text-ink">{person.remark}</p>
                    ) : null}
                  </div>

                  {person.checkedIn ? (
                    <span className="shrink-0 rounded-full bg-success/15 px-3 py-1 text-sm font-bold text-success">
                      Already in
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void sendCheckIn({ attendeeId: person.id, method: 'manual' })}
                      className="min-h-11 shrink-0 rounded-lg bg-primary px-4 py-2 font-bold text-on-primary disabled:opacity-60"
                    >
                      Check in
                    </button>
                  )}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      </div>
    </div>
  );
}
