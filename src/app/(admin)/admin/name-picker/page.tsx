import type { Metadata } from 'next';
import Link from 'next/link';

import { FormPending } from '@/components/FormPending';
import { getData } from '@/data';
import { requireAdmin } from '@/lib/admin-guard';
import { getEventConfig } from '@/lib/config';
import { resolveEventNow } from '@/lib/time';
import { resolveCheckInDay } from '@/modules/check-in/logic';
import { DrawButton } from '@/modules/lucky-draw/components/DrawButton';
import { pickPeople, resetPicker } from '@/modules/name-picker/actions';
import {
  MAX_PICKER_TITLE,
  parsePickerState,
  PICK_COUNTS,
  PICKER_KEY,
} from '@/modules/name-picker/logic';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Name picker' };

const input =
  'mt-1 block min-h-11 w-full rounded-lg border border-line bg-canvas px-3 text-ink focus:border-primary focus:outline-none';

/**
 * Picks people at random to speak, answer a question or come up on stage.
 * Nothing here touches the lucky draw: being picked to talk is not a prize.
 */
export default async function NamePickerPage() {
  await requireAdmin('/admin/name-picker');
  const config = getEventConfig();
  const data = getData();
  const day = resolveCheckInDay(config.days, resolveEventNow({ timezone: config.event.timezone }));
  const [checkedIn, everyone, raw] = await Promise.all([
    day ? data.checkIns.listByDay(day.id) : Promise.resolve([]),
    data.attendees.list(),
    data.settings.get(PICKER_KEY),
  ]);
  const state = parsePickerState(raw);
  const latest = state.latest;

  return (
    <div className="max-w-3xl space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-ink">Name picker</h1>
        <p className="mt-1 text-ink-soft">
          Picks people at random to speak, answer or come up, and spins their names on the big
          screen. It is separate from the{' '}
          <Link href="/admin/lucky-draw" className="font-semibold text-primary">
            Lucky draw
          </Link>
          : being picked here never uses up anyone&apos;s chance of a prize.
        </p>
      </header>

      {latest ? (
        <section className="rounded-xl border-2 border-success bg-surface p-4">
          <h2 className="text-sm font-bold uppercase tracking-wide text-ink-soft">
            Just picked{latest.title ? `: ${latest.title}` : ''}
          </h2>
          <ol className="mt-2 space-y-1">
            {latest.people.map((p, i) => (
              <li key={p.id} className="text-xl font-bold leading-tight text-ink">
                {latest.people.length > 1 ? `${i + 1}. ` : ''}
                {p.name} <span className="text-sm font-normal text-ink-soft">{p.department}</span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <section className="rounded-xl border border-line bg-surface p-4">
        <form action={pickPeople} className="space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-sm font-semibold text-ink">
              How many
              <select name="count" defaultValue="1" className={input}>
                {PICK_COUNTS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label className="min-w-0 flex-1 text-sm font-semibold text-ink">
              Title on the screen (optional)
              <input
                name="title"
                maxLength={MAX_PICKER_TITLE}
                placeholder="For example, Share one idea"
                className={input}
              />
            </label>
          </div>
          <fieldset className="space-y-1">
            <legend className="text-sm font-semibold text-ink">Pick from</legend>
            <label className="flex min-h-11 items-center gap-3 text-ink">
              <input
                type="radio"
                name="pool"
                value="checked-in"
                defaultChecked
                className="size-5"
              />
              People checked in {day ? `on ${day.label}` : 'today'} ({checkedIn.length})
            </label>
            <label className="flex min-h-11 items-center gap-3 text-ink">
              <input type="radio" name="pool" value="everyone" className="size-5" />
              Everyone on the list ({everyone.length})
            </label>
          </fieldset>
          <label className="flex min-h-11 items-center gap-3 text-ink">
            <input type="checkbox" name="fresh" defaultChecked className="size-5" />
            Skip people already picked ({state.pickedIds.length} so far)
          </label>
          <label className="flex min-h-11 items-center gap-3 text-ink">
            <input type="checkbox" name="secretariat" className="size-5" />
            Include the secretariat
          </label>
          <label className="flex min-h-11 items-center gap-3 text-ink">
            <input type="checkbox" name="showOnScreen" defaultChecked className="size-5" />
            Spin it on the big screen
          </label>
          <DrawButton disabled={false} label="Pick" pendingLabel="Picking..." />
        </form>
      </section>

      {state.pickedIds.length > 0 ? (
        <form action={resetPicker} className="rounded-xl border border-line bg-muted p-4">
          <FormPending label="Resetting" />
          <p className="text-sm text-ink-soft">
            {state.pickedIds.length} picked so far. Start again so everyone can be picked.
          </p>
          <button
            type="submit"
            className="mt-2 min-h-11 rounded-lg border border-line px-4 font-semibold text-ink"
          >
            Start the picker again
          </button>
        </form>
      ) : null}
    </div>
  );
}
