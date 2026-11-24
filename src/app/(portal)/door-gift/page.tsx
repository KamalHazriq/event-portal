import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getEventConfig } from '@/lib/config';
import { safeImage } from '@/modules/door-gift/logic';
import { giftFor, itemById, loadDoorGifts } from '@/modules/door-gift/server';
import { safeNext } from '@/modules/identity/logic';
import { currentPlayer } from '@/modules/points/server';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Door gift' };

export default async function DoorGiftPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const config = getEventConfig();
  if (!config.features.doorGift) notFound();
  const next = safeNext((await searchParams).next);
  const [me, state] = await Promise.all([currentPlayer(), loadDoorGifts()]);

  const box = 'rounded-2xl border border-line bg-surface p-5 sm:p-8';

  if (!me) {
    return (
      <div className={box}>
        <h1 className="text-2xl font-bold text-ink">Door gift</h1>
        <p className="mt-2 text-ink-soft">Say who you are first, then spin for your gift.</p>
        <Link
          href="/welcome?next=/door-gift"
          className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-primary px-5 font-bold text-on-primary no-underline"
        >
          Find my name
        </Link>
      </div>
    );
  }

  const claim = state.claims.get(me.id);
  const got = claim ? itemById(state, claim.item) : undefined;
  if (got) {
    return (
      <div className={`${box} text-center`}>
        <p className="eyebrow">Your door gift</p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={safeImage(got.image) || '/door-gifts/massager.svg'}
          alt=""
          className="mx-auto mt-4 size-44"
        />
        <h1 className="mt-3 text-3xl font-bold text-ink">{got.name}</h1>
        <p className="mt-2 text-ink-soft">
          {claim?.collected
            ? 'Collected. Enjoy it!'
            : `For ${me.name}. Collect it at the registration desk.`}
        </p>
        <Link href={next} className="mt-5 inline-block font-semibold text-primary">
          Continue
        </Link>
      </div>
    );
  }

  return (
    <div className={box}>
      <h1 className="text-2xl font-bold text-ink">Door gift</h1>
      <p className="mt-2 text-ink-soft">
        {!giftFor(me, state)
          ? 'Door gifts are not part of this event for you.'
          : 'You spin for your door gift at the registration desk when you check in. Whatever it lands on is yours.'}
      </p>
      <Link href={next} className="mt-4 inline-block font-semibold text-primary">
        Continue
      </Link>
    </div>
  );
}
