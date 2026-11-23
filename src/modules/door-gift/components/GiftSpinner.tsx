'use client';

import Link from 'next/link';
import { useState } from 'react';

type Item = { id: string; name: string; image: string };

/**
 * The door gift spin on a phone: a light runs round the gifts, slowing like
 * a wheel, and stops on the one the server chose.
 */
export function GiftSpinner({ items, next }: { items: Item[]; next: string }) {
  const [lit, setLit] = useState<number | null>(null);
  const [won, setWon] = useState<Item | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const spin = async () => {
    setBusy(true);
    setError('');
    let item: Item;
    try {
      const res = await fetch('/api/door-gift', { method: 'POST' });
      const body = (await res.json()) as { item?: Item; message?: string };
      if (!res.ok || !body.item) throw new Error(body.message ?? 'That did not work.');
      item = body.item;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not work. Try again.');
      setBusy(false);
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
        window.setTimeout(() => setWon(item), 450);
        return;
      }
      i += 1;
      gap = Math.round(gap * 1.09);
      window.setTimeout(tick, gap);
    };
    tick();
  };

  if (won) {
    return (
      <div className="winner-reveal text-center">
        <p className="eyebrow">Your door gift</p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={won.image} alt="" className="mx-auto mt-4 size-44 sm:size-56" />
        <p className="mt-3 text-3xl font-bold text-ink" role="status">
          {won.name}!
        </p>
        <p className="mt-2 text-ink-soft">
          Collect it at the registration desk. It is saved, so you can show this page there.
        </p>
        <Link
          href={next}
          className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-lg bg-primary px-6 font-bold text-on-primary no-underline"
        >
          Continue
          <span aria-hidden="true">→</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="text-center">
      <ul className="grid grid-cols-3 gap-3">
        {items.map((item, idx) => (
          <li
            key={item.id}
            className={`rounded-2xl border-2 bg-surface p-3 transition-all duration-100 ${
              lit === idx
                ? 'scale-105 border-accent shadow-[0_0_2rem_-0.25rem_var(--color-accent)]'
                : 'border-line opacity-70'
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.image} alt="" className="mx-auto aspect-square w-full" />
            <p className="mt-2 text-sm font-semibold leading-tight text-ink">{item.name}</p>
          </li>
        ))}
      </ul>
      {error ? (
        <p role="alert" className="mt-4 font-semibold text-warning">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        onClick={spin}
        disabled={busy}
        className="btn-primary mt-6 min-h-14 rounded-xl bg-primary px-10 text-lg font-bold text-on-primary disabled:opacity-60"
      >
        {busy ? 'Spinning…' : 'Spin for my gift'}
      </button>
    </div>
  );
}
