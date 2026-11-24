'use client';

import { useEffect, useRef, useState } from 'react';

export type GiftItemView = { id: string; name: string; image: string; description?: string };

export type GiftOffer =
  | { state: 'spin'; items: GiftItemView[] }
  | { state: 'has'; item: GiftItemView; collected: boolean };

/**
 * The door gift at the registration desk: a full screen card over the desk
 * (or the kiosk) for the person just checked in. A light runs round the
 * gifts, slows like a wheel and stops on the one the server chose; then the
 * desk hands it over.
 */
export function GiftSpinner({
  attendeeId,
  name,
  offer,
  onClose,
  kiosk = false,
  guest = false,
}: {
  /** The person checked in, or empty for a guest not on the list. */
  attendeeId: string;
  name: string;
  offer: GiftOffer;
  /** Closes the card, saying what was won and whether it was handed over. */
  onClose: (outcome?: { item: GiftItemView; collected: boolean }) => void;
  /** On the self check in tablet: spins by itself, and closes by itself. */
  kiosk?: boolean;
  /** Someone not on the list: the spin makes a guest entry. */
  guest?: boolean;
}) {
  const items = offer.state === 'spin' ? offer.items : [offer.item];
  const [lit, setLit] = useState<number | null>(null);
  const [won, setWon] = useState<GiftItemView | null>(offer.state === 'has' ? offer.item : null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [handed, setHanded] = useState(offer.state === 'has' && offer.collected);
  const started = useRef(false);
  // For a guest, the id the server made, so "Handed over" finds it.
  const claimId = useRef(attendeeId);

  const spin = async () => {
    if (started.current) return;
    started.current = true;
    setBusy(true);
    setError('');
    let item: GiftItemView;
    try {
      const res = await fetch('/api/door-gift', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(guest ? { guest: true, guestName: name } : { attendeeId }),
      });
      const body = (await res.json()) as {
        item?: GiftItemView;
        claimId?: string;
        message?: string;
      };
      if (!res.ok || !body.item) throw new Error(body.message ?? 'That did not work.');
      item = body.item;
      if (body.claimId) claimId.current = body.claimId;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not work. Try again.');
      setBusy(false);
      started.current = false;
      return;
    }
    const target = Math.max(
      0,
      items.findIndex((i) => i.id === item.id),
    );
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Three or four full laps, then on to the gift.
    const steps = reduce ? 0 : items.length * (3 + Math.floor(Math.random() * 2)) + target;
    let i = 0;
    let gap = 60;
    const tick = () => {
      setLit(i % items.length);
      if (i >= steps) {
        setLit(target);
        window.setTimeout(() => {
          setWon(item);
          setBusy(false);
        }, 450);
        return;
      }
      i += 1;
      gap = Math.round(gap * 1.09);
      window.setTimeout(tick, gap);
    };
    tick();
  };

  const handOver = async () => {
    setHanded(true);
    await fetch('/api/door-gift', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ attendeeId: claimId.current, action: 'collected' }),
    }).catch(() => undefined);
    if (won) onClose({ item: won, collected: true });
    else onClose();
  };

  // The kiosk spins straight away, and goes back to waiting afterwards.
  useEffect(() => {
    if (!kiosk || offer.state !== 'spin') return;
    const timer = window.setTimeout(() => void spin(), 600);
    return () => window.clearTimeout(timer);
    // Once, when it opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!kiosk || !won) return;
    const timer = window.setTimeout(() => onClose({ item: won, collected: false }), 9000);
    return () => window.clearTimeout(timer);
  }, [kiosk, won, onClose]);

  const first = name.split(' ')[0] || 'our guest';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Door gift for ${name || 'a guest'}`}
      className="fixed inset-0 z-[90] flex items-center justify-center overflow-y-auto bg-canvas/95 p-4"
    >
      <div className="w-full max-w-xl rounded-2xl border-2 border-accent bg-surface p-5 text-center shadow-2xl sm:p-8">
        <p className="eyebrow">Door gift</p>
        <h2 className="mt-1 text-2xl font-bold text-ink sm:text-3xl">
          {won ? `${first} gets` : `Spin for ${first}`}
        </h2>
        <p className="text-ink-soft">{name || 'Not on the list'}</p>

        {won ? (
          <div className="winner-reveal mt-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={won.image} alt="" className="mx-auto size-40 sm:size-52" />
            <p className="mt-2 text-3xl font-bold text-ink" role="status">
              {won.name}!
            </p>
            {won.description ? <p className="mt-1 text-ink-soft">{won.description}</p> : null}
            {kiosk ? (
              <p className="mt-2 text-ink-soft">Collect it from the secretariat at the desk.</p>
            ) : (
              <div className="mt-5 flex flex-wrap justify-center gap-3">
                {handed ? (
                  <p className="font-semibold text-success">Already handed over.</p>
                ) : (
                  <button
                    type="button"
                    onClick={() => void handOver()}
                    className="btn-primary min-h-12 rounded-xl bg-primary px-6 font-bold text-on-primary"
                  >
                    Handed over
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onClose({ item: won, collected: handed })}
                  className="min-h-12 rounded-xl border border-line px-6 font-semibold text-ink"
                >
                  {handed ? 'Close' : 'Later'}
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            <ul className="mt-5 grid grid-cols-3 gap-3">
              {items.map((item, idx) => (
                <li
                  key={item.id}
                  className={`rounded-2xl border-2 bg-canvas p-3 transition-all duration-100 ${
                    lit === idx
                      ? 'scale-105 border-accent shadow-[0_0_2rem_-0.25rem_var(--color-accent)]'
                      : 'border-line opacity-70'
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.image} alt="" className="mx-auto aspect-square w-full" />
                  <p className="mt-2 text-sm font-semibold leading-tight text-ink">{item.name}</p>
                  {item.description ? (
                    <p className="mt-0.5 text-xs leading-snug text-ink-soft">{item.description}</p>
                  ) : null}
                </li>
              ))}
            </ul>
            {error ? (
              <p role="alert" className="mt-4 font-semibold text-warning">
                {error}
              </p>
            ) : null}
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() => void spin()}
                disabled={busy}
                className="btn-primary min-h-14 rounded-xl bg-primary px-10 text-lg font-bold text-on-primary disabled:opacity-60"
              >
                {busy ? 'Spinning…' : 'Spin for the gift'}
              </button>
              {kiosk ? null : (
                <button
                  type="button"
                  onClick={() => onClose()}
                  disabled={busy}
                  className="min-h-14 rounded-xl border border-line px-6 font-semibold text-ink"
                >
                  Later
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
