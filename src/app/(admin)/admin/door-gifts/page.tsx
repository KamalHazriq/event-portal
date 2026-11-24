import type { Metadata } from 'next';
import Link from 'next/link';

import { FormPending } from '@/components/FormPending';
import { getData } from '@/data';
import { requireAdmin } from '@/lib/admin-guard';
import { getEventConfig } from '@/lib/config';
import { shortDepartment } from '@/lib/departments';
import {
  clearDoorGifts,
  saveDoorGiftSettings,
  setDoorGift,
  toggleCollected,
} from '@/modules/door-gift/actions';
import {
  givenCounts,
  GUEST_PREFIX,
  MAX_GIFT_DESCRIPTION,
  remaining,
  safeImage,
} from '@/modules/door-gift/logic';
import { GiftPhotoInput } from '@/modules/door-gift/components/GiftPhotoInput';
import { giftFor, loadDoorGifts } from '@/modules/door-gift/server';
import { DoorGiftTable, type GiftRow } from '@/modules/door-gift/components/DoorGiftTable';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Door gifts' };

const input =
  'mt-1 block min-h-11 w-full rounded-lg border border-line bg-canvas px-3 text-ink focus:border-primary focus:outline-none';

export default async function DoorGiftsPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const editing = (await searchParams).edit === 'stock';
  await requireAdmin('/admin/door-gifts');
  const config = getEventConfig();
  const [state, people] = await Promise.all([loadDoorGifts(), getData().attendees.list()]);
  const given = givenCounts(state.claims.values());
  const left = remaining(state.config.items, given);
  const collectedBy = new Map<string, number>();
  for (const c of state.claims.values())
    if (c.collected) collectedBy.set(c.item, (collectedBy.get(c.item) ?? 0) + 1);
  const eligible = people.filter((p) => giftFor(p, state));
  const guests = [...state.claims].filter(([id]) => id.startsWith(GUEST_PREFIX));
  const totalStock = state.config.items.reduce((n, i) => n + i.stock, 0);

  const rows: GiftRow[] = eligible
    .map((p) => {
      const claim = state.claims.get(p.id);
      return {
        id: p.id,
        name: p.name,
        department: shortDepartment(config, p.department),
        item: claim?.item ?? '',
        by: claim?.by ?? '',
        collected: claim?.collected ?? false,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  if (!config.features.doorGift) {
    return <p className="text-ink-soft">Door gifts are switched off in the event file.</p>;
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-ink">Door gifts</h1>
        <p className="mt-1 text-ink-soft">
          The first time someone says who they are on their phone, they spin for one gift. The
          chance of each follows how many are left, so no gift runs out early and none goes below
          zero. You can change anyone&apos;s gift below.
        </p>
      </header>

      <section
        className={`rounded-xl border-2 p-4 ${state.open ? 'border-success bg-success/10' : 'border-line bg-surface'}`}
        role="status"
      >
        <p className="font-bold text-ink">
          {state.open ? 'The spin is open now.' : 'The spin is closed right now.'}
        </p>
        <p className="text-sm text-ink-soft">
          {state.claims.size - guests.length} of {eligible.length} people have a gift
          {guests.length > 0 ? `, plus ${guests.length} guests not on the list` : ''}. {totalStock}{' '}
          gifts in stock in all
          {totalStock < eligible.length
            ? `, which is ${eligible.length - totalStock} short of everyone`
            : ''}
          .{' '}
          <Link href="/door-gift" className="font-semibold text-primary">
            See the spin page
          </Link>
        </p>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-bold text-ink">Stock</h2>
        <Link
          href="/admin/door-gifts?edit=stock#stock"
          className="inline-flex min-h-11 items-center rounded-lg border border-line px-4 font-semibold text-ink no-underline hover:border-primary"
        >
          Edit stock, gifts and when to spin
        </Link>
      </div>
      <section className="grid gap-3 sm:grid-cols-3" aria-label="Stock">
        {state.config.items.map((item) => (
          <div key={item.id} className="rounded-xl border border-line bg-surface p-4">
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={safeImage(item.image)} alt="" className="size-14 shrink-0" />
              <div className="min-w-0">
                <p className="font-bold text-ink">{item.name}</p>
                {item.description ? (
                  <p className="text-sm text-ink-soft">{item.description}</p>
                ) : null}
                <p className="text-sm text-ink-soft">
                  {given.get(item.id) ?? 0} given, {collectedBy.get(item.id) ?? 0} collected
                </p>
              </div>
            </div>
            <p className="mt-2 text-3xl font-bold tabular-nums text-ink">
              {left.get(item.id) ?? 0}
              <span className="text-base font-semibold text-ink-soft"> of {item.stock} left</span>
            </p>
          </div>
        ))}
      </section>

      <section aria-labelledby="who-got">
        <h2 id="who-got" className="font-bold text-ink">
          Who got what
        </h2>
        <p className="mt-1 text-sm text-ink-soft">
          Change a gift with the dropdown. Choose &ldquo;No gift yet&rdquo; to let someone spin
          again. Tick Collected when it is handed over at the desk.
        </p>
        <div className="mt-3">
          <DoorGiftTable
            rows={rows}
            items={state.config.items.map((i) => ({ id: i.id, name: i.name }))}
            setGift={setDoorGift}
            toggleCollected={toggleCollected}
          />
        </div>
      </section>

      {guests.length > 0 ? (
        <section aria-labelledby="guests" className="rounded-xl border border-line bg-surface p-4">
          <h2 id="guests" className="font-bold text-ink">
            Guests not on the list ({guests.length})
          </h2>
          <ul className="mt-2 divide-y divide-line">
            {guests.map(([id, claim]) => (
              <li key={id} className="flex flex-wrap items-center gap-3 py-2">
                <span className="min-w-0 flex-1 text-ink">
                  <span className="font-semibold">{claim.guest || 'Guest, no name given'}</span>{' '}
                  <span className="text-sm text-ink-soft">
                    {state.config.items.find((i) => i.id === claim.item)?.name ?? claim.item}
                  </span>
                </span>
                <form action={toggleCollected}>
                  <input type="hidden" name="attendeeId" value={id} />
                  <button
                    type="submit"
                    className={`min-h-11 rounded-lg border px-3 text-sm font-semibold ${
                      claim.collected
                        ? 'border-success bg-success/15 text-ink'
                        : 'border-line text-ink'
                    }`}
                  >
                    {claim.collected ? '✓ Collected' : 'Mark collected'}
                  </button>
                </form>
                <form action={setDoorGift}>
                  <input type="hidden" name="attendeeId" value={id} />
                  <input type="hidden" name="item" value="" />
                  <button
                    type="submit"
                    className="min-h-11 rounded-lg border border-line px-3 text-sm font-semibold text-ink"
                  >
                    Remove
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <details
        id="stock"
        className="scroll-mt-24 rounded-xl border border-line bg-surface p-4"
        open={editing}
      >
        <summary className="cursor-pointer text-lg font-bold text-ink">
          Gifts, stock and when to spin
        </summary>
        <p className="mt-2 text-sm text-ink-soft">
          Stock is the total of each gift you have. &ldquo;Left&rdquo; is worked out from it, so
          change it any time, even after people have spun.
        </p>
        <form action={saveDoorGiftSettings} className="mt-3 space-y-4">
          <FormPending label="Saving" />
          <fieldset className="space-y-1">
            <legend className="text-sm font-semibold text-ink">When can people spin?</legend>
            {(
              [
                ['first-day', `Only on the first day (${config.days[0]?.label ?? 'Day 1'})`],
                ['on', 'Now, any day (for testing, or if the first day was missed)'],
                ['off', 'Not at all'],
              ] as const
            ).map(([value, text]) => (
              <label key={value} className="flex min-h-11 items-center gap-3 text-ink">
                <input
                  type="radio"
                  name="mode"
                  value={value}
                  defaultChecked={state.config.mode === value}
                  className="size-5"
                />
                {text}
              </label>
            ))}
          </fieldset>
          <label className="flex min-h-11 items-center gap-3 text-ink">
            <input
              type="checkbox"
              name="secretariat"
              defaultChecked={state.config.secretariat}
              className="size-5"
            />
            The secretariat spin too
          </label>
          {[...state.config.items, { id: '', name: '', stock: 0, image: '', description: '' }].map(
            (item, j) => (
              <fieldset
                key={item.id || 'new'}
                className="grid gap-3 rounded-lg border border-line p-3 sm:grid-cols-[2fr_1fr_auto]"
              >
                <legend className="px-1 text-sm font-semibold text-ink">
                  {item.id ? item.name : 'Add a gift'}
                </legend>
                <input type="hidden" name={`g${j}.id`} value={item.id} />
                <label className="text-sm font-semibold text-ink">
                  Name
                  <input
                    name={`g${j}.name`}
                    defaultValue={item.name}
                    maxLength={60}
                    className={input}
                  />
                </label>
                <label className="text-sm font-semibold text-ink">
                  Stock
                  <input
                    name={`g${j}.stock`}
                    type="number"
                    min={0}
                    max={9999}
                    defaultValue={item.id ? item.stock : ''}
                    className={input}
                  />
                </label>
                <div className="text-sm font-semibold text-ink sm:col-span-2">
                  Photo
                  <input type="hidden" name={`g${j}.image`} value={item.image} />
                  <div className="mt-1">
                    <GiftPhotoInput
                      name={`g${j}.upload`}
                      current={item.id ? safeImage(item.image) : ''}
                      label={item.name || 'the new gift'}
                    />
                  </div>
                </div>
                <label className="text-sm font-semibold text-ink sm:col-span-2">
                  Short description (optional)
                  <input
                    name={`g${j}.description`}
                    defaultValue={item.description ?? ''}
                    maxLength={MAX_GIFT_DESCRIPTION}
                    placeholder="For example: Rechargeable, four massage heads"
                    className={input}
                  />
                </label>
                {item.id ? (
                  <label className="flex min-h-11 items-center gap-2 self-end text-sm text-ink">
                    <input type="checkbox" name={`g${j}.remove`} className="size-5" />
                    Remove
                  </label>
                ) : (
                  <span />
                )}
              </fieldset>
            ),
          )}
          <button
            type="submit"
            className="min-h-11 rounded-lg bg-primary px-5 font-bold text-on-primary"
          >
            Save the door gifts
          </button>
        </form>
      </details>

      {state.claims.size > 0 ? (
        <details className="rounded-xl border border-line bg-muted p-4">
          <summary className="cursor-pointer font-semibold text-ink">Start over</summary>
          <form action={clearDoorGifts} className="mt-2 flex flex-wrap items-center gap-3">
            <label className="flex min-h-11 items-center gap-2 text-ink">
              <input type="checkbox" name="confirm" value="yes" required className="size-5" />
              Yes, clear all {state.claims.size} gifts so everyone spins again
            </label>
            <button
              type="submit"
              className="min-h-11 rounded-lg border border-line px-4 font-semibold text-ink"
            >
              Clear
            </button>
          </form>
        </details>
      ) : null}
    </div>
  );
}
