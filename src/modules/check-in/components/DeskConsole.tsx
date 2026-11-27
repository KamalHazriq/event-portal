'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { looksLikeBusinessCard } from '../business-card';
import { parseScanPayload, scanOutcomeMessage, type ScanOutcome } from '../logic';
import { shouldQueue } from '../offline-queue';
import { useCheckInQueue } from './useCheckInQueue';
import { GiftSpinner, type GiftOffer } from '@/modules/door-gift/components/GiftSpinner';
import { useQrScanner } from './useQrScanner';

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
  /** Saved on this device because there was no connection. */
  queued?: boolean;
  /** The door gift: still to spin for, or what they got. */
  gift?: GiftOffer | null;
  /** Early or late against the day's cut-off, when one applies. */
  timing?: { early: boolean; before: string; pretend: boolean } | null;
};

/** Ignore the same tag for this long, so one tag held up does not spam. */
const REPEAT_WINDOW_MS = 4000;

/** How often the counter catches up with other desks. */
const POLL_MS = 5000;

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
  // The door gift spin, over the whole desk, for the person just checked in.
  const [giftOpen, setGiftOpen] = useState<{ id: string; name: string; offer: GiftOffer } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchMessage, setSearchMessage] = useState('');
  // The second way to find someone: the whole list, one tap to check in.
  const [mode, setMode] = useState<'search' | 'browse'>('search');
  const [everyone, setEveryone] = useState<SearchResult[] | null>(null);
  const [group, setGroup] = useState('all');
  const [onlyMissing, setOnlyMissing] = useState(true);
  const refreshCounter = useCallback(() => {
    void fetch(`/api/headcount?dayId=${encodeURIComponent(dayId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((body: { total?: Rate } | null) => {
        if (body?.total) setHeadcount(body.total);
      })
      .catch(() => undefined);
  }, [dayId]);
  const offline = useCheckInQueue(refreshCounter);

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
        let response: Response | null = null;
        try {
          response = await fetch('/api/check-in', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...input, dayId }),
          });
        } catch {
          response = null;
        }

        // No connection, or the server is down: keep the check in on this
        // device and send it when it can, so the queue keeps moving.
        if (shouldQueue(response ? response.status : null)) {
          const known = [...searchResults, ...(everyone ?? [])].find(
            (row) => row.id === input.attendeeId,
          );
          offline.save({
            id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
            dayId,
            method: input.method,
            payload: input.payload,
            attendeeId: input.attendeeId,
            cardEmail: input.cardEmail,
            queuedAt: new Date().toISOString(),
            label: known?.name,
          });
          setResult({
            outcome: 'error',
            queued: true,
            message:
              'No connection. Saved on this device, it will check in when the Wi-Fi is back.',
            attendee: known,
          });
          beep(true);
          if (known) {
            const mark = (rows: SearchResult[]) =>
              rows.map((row) => (row.id === known.id ? { ...row, checkedIn: true } : row));
            setSearchResults(mark);
            setEveryone((rows) => (rows ? mark(rows) : rows));
          }
          return;
        }
        if (!response) return;
        const body = (await response.json()) as Result & { headcount?: Rate };

        setResult({
          outcome: body.outcome,
          message: body.message,
          attendee: body.attendee,
          card: body.card,
          candidates: body.candidates,
          gift: body.gift,
          timing: body.timing,
        });
        // First time at the desk with no gift yet: straight to the spin.
        if (body.gift?.state === 'spin' && body.attendee) {
          setGiftOpen({ id: body.attendee.id, name: body.attendee.name, offer: body.gift });
        }
        if (body.headcount) setHeadcount(body.headcount);
        // Not on the list: start the name search for the desk.
        if (body.outcome === 'card-not-found' && body.card?.name) setQuery(body.card.name);
        beep(body.outcome === 'checked-in');

        // Keep both lists honest: they stop saying this person is not in yet.
        if (body.outcome === 'checked-in' || body.outcome === 'already-checked-in') {
          const id = body.attendee?.id;
          const mark = (rows: SearchResult[]) =>
            rows.map((row) => (row.id === id ? { ...row, checkedIn: true } : row));
          setSearchResults(mark);
          setEveryone((rows) => (rows ? mark(rows) : rows));
        }
      } catch {
        setResult({ outcome: 'error', message: scanOutcomeMessage('error') });
        beep(false);
      } finally {
        setBusy(false);
      }
    },
    [beep, dayId, everyone, offline, searchResults],
  );

  const checkInById = useCallback(
    (attendeeId: string) => void sendCheckIn({ attendeeId, method: 'manual' }),
    [sendCheckIn],
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

  const { videoRef, canvasRef, cameraOn, cameraError, startCamera, stopCamera } = useQrScanner(
    handleScanned,
    'environment',
  );

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

  // The whole list, while browsing; refreshed so other desks' check ins show.
  useEffect(() => {
    if (mode !== 'browse') return;
    let stopped = false;
    const load = async () => {
      try {
        const response = await fetch(
          `/api/attendees/search?all=1&dayId=${encodeURIComponent(dayId)}`,
        );
        const body = (await response.json()) as { results?: SearchResult[] };
        if (!stopped && body.results) setEveryone(body.results);
      } catch {
        // Keep showing the last list.
      }
    };
    void load();
    const timer = window.setInterval(load, 10_000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [mode, dayId]);

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

  const tone = result?.queued
    ? 'border-warning bg-warning/10'
    : result?.outcome === 'checked-in'
      ? 'border-success bg-success/10'
      : result?.outcome === 'already-checked-in' || result?.outcome === 'choose'
        ? 'border-warning bg-warning/10'
        : result
          ? 'border-live bg-live/10'
          : // Waiting for the first scan: a plain hint, not a box that looks like a field.
            'border-transparent px-0 py-1';

  return (
    <div className="space-y-4">
      {giftOpen ? (
        <GiftSpinner
          key={giftOpen.id}
          attendeeId={giftOpen.id}
          name={giftOpen.name}
          offer={giftOpen.offer}
          onClose={(outcome) => {
            setGiftOpen(null);
            // Keyboard users land back on the search, ready for the next person.
            window.setTimeout(() => document.getElementById('desk-search')?.focus(), 80);
            // The result card now says which gift, without asking the server again.
            if (outcome) {
              setResult((r) =>
                r
                  ? {
                      ...r,
                      gift: { state: 'has', item: outcome.item, collected: outcome.collected },
                    }
                  : r,
              );
            }
          }}
        />
      ) : null}
      {!offline.online || offline.queue.length > 0 || offline.review.length > 0 ? (
        <section
          role="status"
          className="space-y-2 rounded-xl border-2 border-warning bg-warning/10 p-3 text-ink"
        >
          {!offline.online ? (
            <p className="font-bold">
              No connection. Keep scanning: check ins are saved on this device and sent when the
              Wi-Fi is back. To check in by name, use the Whole list tab.
            </p>
          ) : null}
          {offline.queue.length > 0 ? (
            <p className="flex flex-wrap items-center gap-3">
              <span className="font-semibold">
                {offline.queue.length} check in{offline.queue.length === 1 ? '' : 's'} saved on this
                device, waiting to be sent.
              </span>
              <button
                type="button"
                onClick={() => void offline.flush()}
                className="min-h-11 rounded-lg border border-line bg-surface px-4 font-semibold"
              >
                Send now
              </button>
            </p>
          ) : null}
          {offline.review.length > 0 ? (
            <ul className="space-y-1">
              {offline.review.map((item) => (
                <li key={item.id} className="flex flex-wrap items-center gap-3">
                  <span>
                    <span className="font-semibold">{item.label}:</span> {item.message}
                  </span>
                  <button
                    type="button"
                    onClick={() => offline.dismiss(item.id)}
                    className="min-h-11 rounded-lg border border-line bg-surface px-3 text-sm font-semibold"
                  >
                    Dismiss
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}
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
          <p className="text-right text-sm text-ink-soft">
            {headcount.remaining} to go
            <span className="block text-xs">Everyone, secretariat included</span>
          </p>
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
            {result.timing ? (
              <p
                className={`mt-1 inline-block rounded-full px-3 py-1 text-sm font-bold ${
                  result.timing.early ? 'bg-success/15 text-success' : 'bg-live/15 text-live'
                }`}
              >
                {result.timing.early
                  ? `Early (before ${result.timing.before}): bonus point`
                  : `Late (after ${result.timing.before}): no early bonus`}
                {result.timing.pretend ? ', pretend time' : ''}
              </p>
            ) : null}
            {result.attendee ? (
              <>
                <p className="mt-1 text-2xl font-bold leading-tight text-ink">
                  {result.attendee.name}
                </p>
                <p className="text-ink-soft">
                  {[result.attendee.title, result.attendee.department].filter(Boolean).join(', ')}
                </p>
                {result.gift && result.attendee ? (
                  <p className="mt-2 flex flex-wrap items-center gap-2 text-ink">
                    <span className="font-semibold">
                      Door gift:{' '}
                      {result.gift.state === 'has'
                        ? `${result.gift.item.name}${result.gift.collected ? ' (handed over)' : ', not handed over yet'}`
                        : 'not spun yet'}
                    </span>
                    {result.gift.state === 'spin' ||
                    (result.gift.state === 'has' && !result.gift.collected) ? (
                      <button
                        type="button"
                        onClick={() =>
                          result.attendee && result.gift
                            ? setGiftOpen({
                                id: result.attendee.id,
                                name: result.attendee.name,
                                offer: result.gift,
                              })
                            : undefined
                        }
                        className="min-h-11 rounded-lg border border-line bg-surface px-3 text-sm font-semibold"
                      >
                        {result.gift.state === 'spin' ? 'Spin now' : 'Show'}
                      </button>
                    ) : null}
                  </p>
                ) : null}
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
          <p className="text-sm text-ink-soft">
            <span aria-hidden="true">↓ </span>
            Scan a name tag or the business card in the TNB app, or search for a name below. The
            result shows here.
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
              Scanner or paste a code
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
              For a handheld barcode scanner (it types the code here), or to paste the text of a QR
              code. Most people will not need this: use the camera, or Find someone below.
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
          <h2 className="font-bold text-ink">Find someone</h2>
          <p className="text-sm text-ink-soft">For a lost tag or a code that will not read.</p>

          <div
            className="mt-3 grid grid-cols-2 gap-2"
            role="group"
            aria-label="How to find someone"
          >
            {(
              [
                ['search', 'Search'],
                ['browse', 'Whole list'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={mode === value}
                onClick={() => setMode(value)}
                className={`min-h-11 rounded-lg border px-3 font-semibold ${
                  mode === value
                    ? 'border-primary bg-primary text-on-primary'
                    : 'border-line bg-canvas text-ink hover:border-primary'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {mode === 'search' ? (
            <>
              <label htmlFor="desk-search" className="sr-only">
                Search for a name, staff number or department
              </label>
              <input
                id="desk-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Name, staff number or department"
                className="mt-3 min-h-11 w-full rounded-lg border border-line bg-canvas px-3 py-2 text-ink"
              />

              {searchMessage ? <p className="mt-2 text-sm text-ink-soft">{searchMessage}</p> : null}

              {searchResults.length > 0 ? (
                <ul className="mt-3 space-y-2">
                  {searchResults.map((person) => (
                    <PersonRow
                      key={person.id}
                      person={person}
                      busy={busy}
                      onCheckIn={checkInById}
                    />
                  ))}
                </ul>
              ) : null}
            </>
          ) : (
            <BrowseList
              people={everyone}
              busy={busy}
              group={group}
              onGroup={setGroup}
              onlyMissing={onlyMissing}
              onOnlyMissing={setOnlyMissing}
              onCheckIn={checkInById}
            />
          )}
        </section>
      </div>
    </div>
  );
}

function PersonRow({
  person,
  busy,
  onCheckIn,
  showDepartment = true,
}: {
  person: SearchResult;
  busy: boolean;
  onCheckIn: (attendeeId: string) => void;
  showDepartment?: boolean;
}) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line p-3">
      <div className="min-w-0 flex-1 basis-40">
        <p className="font-bold text-ink">{person.name}</p>
        <p className="text-sm text-ink-soft">
          {[person.title, showDepartment ? person.department : ''].filter(Boolean).join(', ')}
        </p>
        {person.remark ? <p className="text-sm font-semibold text-ink">{person.remark}</p> : null}
      </div>

      {person.checkedIn ? (
        <span className="shrink-0 rounded-full bg-success/15 px-3 py-1 text-sm font-bold text-success">
          Already in
        </span>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => onCheckIn(person.id)}
          className="min-h-11 shrink-0 rounded-lg bg-primary px-4 py-2 font-bold text-on-primary disabled:opacity-60"
        >
          Check in
        </button>
      )}
    </li>
  );
}

/** Everyone on the list, grouped by department, so a tap checks them in. */
function BrowseList({
  people,
  busy,
  group,
  onGroup,
  onlyMissing,
  onOnlyMissing,
  onCheckIn,
}: {
  people: SearchResult[] | null;
  busy: boolean;
  group: string;
  onGroup: (value: string) => void;
  onlyMissing: boolean;
  onOnlyMissing: (value: boolean) => void;
  onCheckIn: (attendeeId: string) => void;
}) {
  if (people === null) return <p className="mt-3 text-sm text-ink-soft">Loading the list…</p>;

  const departments = [...new Set(people.map((p) => p.department || 'No department'))].sort();
  const count = (dept: string) => {
    const mine = people.filter((p) => (p.department || 'No department') === dept);
    return { total: mine.length, arrived: mine.filter((p) => p.checkedIn).length };
  };

  const shown = people.filter(
    (p) =>
      (group === 'all' || (p.department || 'No department') === group) &&
      (!onlyMissing || !p.checkedIn),
  );
  const groups = departments.filter((d) =>
    shown.some((p) => (p.department || 'No department') === d),
  );

  return (
    <div className="mt-3 space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="block text-sm font-semibold text-ink">
          Department
          <select
            value={group}
            onChange={(event) => onGroup(event.target.value)}
            className="mt-1 block min-h-11 rounded-lg border border-line bg-canvas px-3 text-ink"
          >
            <option value="all">All departments ({people.length})</option>
            {departments.map((dept) => {
              const c = count(dept);
              return (
                <option key={dept} value={dept}>
                  {dept} ({c.arrived}/{c.total} in)
                </option>
              );
            })}
          </select>
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm font-semibold text-ink">
          <input
            type="checkbox"
            checked={onlyMissing}
            onChange={(event) => onOnlyMissing(event.target.checked)}
            className="size-5"
          />
          Only people not in yet
        </label>
      </div>

      {shown.length === 0 ? (
        <p className="rounded-lg border border-success bg-success/10 p-3 font-semibold text-ink">
          {onlyMissing ? 'Everyone here is in.' : 'Nobody on the list.'}
        </p>
      ) : (
        <div className="max-h-[32rem] space-y-4 overflow-y-auto pr-1">
          {groups.map((dept) => (
            <section key={dept} aria-label={dept}>
              <h3 className="mb-1 text-sm font-bold text-ink-soft">
                {dept}{' '}
                <span className="font-normal">
                  ({count(dept).arrived}/{count(dept).total} in)
                </span>
              </h3>
              <ul className="space-y-2">
                {shown
                  .filter((p) => (p.department || 'No department') === dept)
                  .map((person) => (
                    <PersonRow
                      key={person.id}
                      person={person}
                      busy={busy}
                      onCheckIn={onCheckIn}
                      showDepartment={false}
                    />
                  ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
