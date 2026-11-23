import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getEventConfig } from '@/lib/config';
import { safeImage } from '@/modules/door-gift/logic';
import { GiftSpinner } from '@/modules/door-gift/components/GiftSpinner';
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
  const items = state.config.items.map((i) => ({
    id: i.id,
    name: i.name,
    image: safeImage(i.image) || '/door-gifts/massager.svg',
  }));

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

  if (!state.open || !giftFor(me, state)) {
    return (
      <div className={box}>
        <h1 className="text-2xl font-bold text-ink">Door gift</h1>
        <p className="mt-2 text-ink-soft">
          {!giftFor(me, state)
            ? 'Door gifts are for participants.'
            : 'The door gift spin is not open right now. It opens on the first day.'}
        </p>
        <Link href={next} className="mt-4 inline-block font-semibold text-primary">
          Continue
        </Link>
      </div>
    );
  }

  return (
    <div className={box}>
      <header className="mb-6 text-center">
        <p className="eyebrow">Welcome, {me.name.split(' ')[0]}</p>
        <h1 className="mt-1 text-2xl font-bold text-ink sm:text-3xl">Spin for your door gift</h1>
        <p className="mt-2 text-ink-soft">One spin each. Whatever it lands on is yours.</p>
      </header>
      <GiftSpinner items={items} next={next} />
    </div>
  );
}
