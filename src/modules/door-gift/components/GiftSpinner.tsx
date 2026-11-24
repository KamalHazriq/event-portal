'use client';

import { useEffect, useRef, useState } from 'react';

import { spinSchedule } from '@/modules/lucky-draw/logic';
import { Confetti } from '@/modules/lucky-draw/components/LuckyDrawSpinner';
import { playFanfare, playTick, unlockSound } from '@/modules/lucky-draw/sound';

export type GiftItemView = { id: string; name: string; image: string; description?: string };

export type GiftOffer =
  | { state: 'spin'; items: GiftItemView[] }
  | { state: 'has'; item: GiftItemView; collected: boolean };

/** How long the reel turns: long enough to build up, short enough for a queue. */
const SPIN_MS = 6500;

/**
 * The door gift at the registration desk (or the kiosk): a full screen card
 * for the person just checked in. They press Spin, the gifts flick past in
 * one window like the lucky draw's names, slowing down, and it stops on the
 * one the server chose, with confetti and a fanfare.
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
  /** On the self check in tablet: Done instead of Handed over. */
  kiosk?: boolean;
  /** Someone not on the list: the spin makes a guest entry. */
  guest?: boolean;
}) {
  const items = offer.state === 'spin' ? offer.items : [offer.item];
  const [shown, setShown] = useState(0);
  const [step, setStep] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [won, setWon] = useState<GiftItemView | null>(offer.state === 'has' ? offer.item : null);
  const [celebrate, setCelebrate] = useState(false);
  const [error, setError] = useState('');
  const [handed, setHanded] = useState(offer.state === 'has' && offer.collected);
  const started = useRef(false);
  // For a guest, the id the server made, so "Handed over" finds it.
  const claimId = useRef(attendeeId);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const spin = async () => {
    if (started.current) return;
    started.current = true;
    unlockSound();
    setError('');
    setSpinning(true);
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
      setSpinning(false);
      started.current = false;
      return;
    }
    const target = Math.max(0, items.findIndex((i) => i.id === item.id));
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const gaps = reduce ? [] : spinSchedule(SPIN_MS);
    // Start where the last flick lands on the gift that was won.
    const start = (((target - gaps.length) % items.length) + items.length) % items.length;
    let i = 0;
    const tick = () => {
      if (i >= gaps.length) {
        setShown(target);
        setStep((n) => n + 1);
        setSpinning(false);
        setWon(item);
        if (!reduce) setCelebrate(true);
        playFanfare();
        return;
      }
      setShown((start + i) % items.length);
      setStep((n) => n + 1);
      playTick();
      timer.current = window.setTimeout(tick, gaps[i]);
      i += 1;
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

  // The kiosk goes back to waiting by itself if nobody presses Done.
  useEffect(() => {
    if (!kiosk || !won) return;
    const t = window.setTimeout(() => onClose({ item: won, collected: false }), 30_000);
    return () => window.clearTimeout(t);
  }, [kiosk, won, onClose]);

  const current = won ?? items[shown] ?? items[0]!;
  const fullName = name || 'Our guest';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Door gift for ${name || 'a guest'}`}
      className="fixed inset-0 z-[90] flex items-center justify-center overflow-y-auto bg-canvas/95 p-4"
    >
      {celebrate ? <Confetti /> : null}
      <div className="relative w-full max-w-xl rounded-2xl border-2 border-accent bg-surface p-5 text-center shadow-2xl sm:p-8">
        <p className="eyebrow">Door gift</p>
        <h2 className="mt-1 text-2xl font-bold leading-tight text-ink sm:text-3xl">{fullName}</h2>

        {/* One window, the gifts flicking past like the lucky draw's names. */}
        <div
          className={`draw-drum mx-auto mt-5 max-w-sm overflow-hidden rounded-2xl border-2 bg-canvas p-4 ${
            won ? 'border-success' : 'border-accent'
          }`}
        >
          <div key={step} className={spinning ? 'draw-tick' : won ? 'winner-reveal' : ''}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={current.image} alt="" className="mx-auto size-40 object-contain sm:size-52" />
            <p className="mt-2 text-xl font-bold text-ink">{current.name}</p>
            {current.description && !spinning ? (
              <p className="mt-0.5 text-sm text-ink-soft">{current.description}</p>
            ) : null}
          </div>
        </div>

        {won ? (
          <div className="mt-5">
            <p className="text-2xl font-bold text-ink" role="status">
              Your door gift is the {won.name}!
            </p>
            {kiosk ? (
              <p className="mt-1 text-ink-soft">Collect it from the secretariat at the desk.</p>
            ) : null}
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              {kiosk ? (
                <button
                  type="button"
                  onClick={() => onClose({ item: won, collected: false })}
                  className="btn-primary min-h-12 rounded-xl bg-primary px-8 font-bold text-on-primary"
                >
                  Done
                </button>
              ) : handed ? (
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
              {kiosk ? null : (
                <button
                  type="button"
                  onClick={() => onClose({ item: won, collected: handed })}
                  className="min-h-12 rounded-xl border border-line px-6 font-semibold text-ink"
                >
                  {handed ? 'Close' : 'Later'}
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            {spinning ? null : (
              <ul className="mt-4 flex justify-center gap-2" aria-label="The gifts">
                {items.map((item) => (
                  <li key={item.id} className="w-20 text-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.image}
                      alt=""
                      className="mx-auto size-12 rounded-lg border border-line bg-canvas object-contain"
                    />
                    <p className="mt-1 text-[11px] leading-tight text-ink-soft">{item.name}</p>
                  </li>
                ))}
              </ul>
            )}
            {error ? (
              <p role="alert" className="mt-4 font-semibold text-warning">
                {error}
              </p>
            ) : null}
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() => void spin()}
                disabled={spinning}
                className="btn-primary min-h-14 rounded-xl bg-primary px-12 text-xl font-bold text-on-primary disabled:opacity-60"
              >
                {spinning ? 'Spinning…' : 'Spin!'}
              </button>
              {spinning ? null : (
                <button
                  type="button"
                  onClick={() => onClose()}
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
