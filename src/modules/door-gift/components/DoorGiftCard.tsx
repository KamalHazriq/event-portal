import Link from 'next/link';

import { getEventConfig } from '@/lib/config';
import { currentPlayer } from '@/modules/points/server';

import { safeImage } from '../logic';
import { giftFor, itemById, loadDoorGifts } from '../server';

/** On the home page: spin for your door gift, or which one is yours. */
export async function DoorGiftCard() {
  if (!getEventConfig().features.doorGift) return null;
  const me = await currentPlayer();
  if (!me) return null;
  const state = await loadDoorGifts();
  if (!giftFor(me, state)) return null;
  const claim = state.claims.get(me.id);
  const got = claim ? itemById(state, claim.item) : undefined;

  if (got) {
    if (claim?.collected) return null;
    return (
      <section className="flex items-center gap-4 rounded-xl border border-line bg-surface p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={safeImage(got.image)} alt="" className="size-14 shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink-soft">Your door gift</p>
          <p className="text-lg font-bold text-ink">{got.name}</p>
          <p className="text-sm text-ink-soft">Collect it at the registration desk.</p>
        </div>
      </section>
    );
  }
  if (!state.open) return null;
  return (
    <Link
      href="/door-gift?next=/"
      className="flex items-center gap-4 rounded-xl border-2 border-accent bg-surface p-4 no-underline transition hover:-translate-y-0.5"
    >
      <span aria-hidden="true" className="text-4xl">
        🎁
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-lg font-bold text-ink">Spin for your door gift</span>
        <span className="block text-sm text-ink-soft">One spin each. Tap to play.</span>
      </span>
      <span aria-hidden="true" className="font-bold text-accent">
        →
      </span>
    </Link>
  );
}
