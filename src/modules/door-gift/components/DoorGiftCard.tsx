import { Icon } from '@/components/icons';
import { getEventConfig } from '@/lib/config';
import { currentPlayer } from '@/modules/points/server';

import { safeImage } from '../logic';
import { giftFor, itemById, loadDoorGifts } from '../server';

/** On the home page: spin for your door gift, or which one is yours. */
export async function DoorGiftCard() {
  if (!getEventConfig().features.doorGift) return null;
  // A card is never worth breaking the home page for.
  const [me, state] = await Promise.all([
    currentPlayer().catch(() => null),
    loadDoorGifts().catch(() => null),
  ]);
  if (!me || !state) return null;
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
          {got.description ? <p className="text-sm text-ink-soft">{got.description}</p> : null}
          <p className="text-sm text-ink-soft">Collect it at the registration desk.</p>
        </div>
      </section>
    );
  }
  if (!state.open) return null;
  return (
    <section className="flex items-center gap-4 rounded-xl border-2 border-accent bg-surface p-4">
      <span aria-hidden="true" className="text-4xl">
        <Icon name="gift" className="size-6" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-lg font-bold text-ink">A door gift is waiting</span>
        <span className="block text-sm text-ink-soft">
          Spin for it at the registration desk when you check in.
        </span>
      </span>
    </section>
  );
}
