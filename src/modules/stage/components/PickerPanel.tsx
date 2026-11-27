import { getData } from '@/data';
import { getEventConfig } from '@/lib/config';
import { pickPeople, resetPicker } from '@/modules/name-picker/actions';
import {
  PICK_COUNTS,
  MAX_PICKER_TITLE,
  parsePickerState,
  PICKER_KEY,
} from '@/modules/name-picker/logic';
import { DrawButton } from '@/modules/lucky-draw/components/DrawButton';

/** The name picker, run from the stage console: how many, a title, Pick. */
export async function PickerPanel() {
  getEventConfig();
  const state = parsePickerState(await getData().settings.get(PICKER_KEY));
  const latest = state.latest;

  return (
    <section className="space-y-3 rounded-xl border border-line bg-surface p-4">
      <h2 className="text-sm font-bold uppercase tracking-wide text-ink-soft">Name picker</h2>
      <form action={pickPeople} className="space-y-3">
        <input type="hidden" name="pool" value="checked-in" />
        <input type="hidden" name="fresh" value="on" />
        <input type="hidden" name="fun" value="on" />
        <input type="hidden" name="showOnScreen" value="on" />
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col text-sm font-semibold text-ink">
            How many
            <select
              name="count"
              defaultValue="1"
              className="mt-1 block min-h-11 rounded-lg border border-line bg-canvas px-3 text-ink"
            >
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
              className="mt-1 block min-h-11 w-full rounded-lg border border-line bg-canvas px-3 text-ink"
            />
          </label>
        </div>
        <DrawButton disabled={false} label="Pick" pendingLabel="Picking..." />
        <p className="text-sm text-ink-soft">
          From people checked in today, skipping anyone already picked ({state.pickedIds.length} so
          far), with confetti and a fanfare. Other choices are on the Name picker page.
        </p>
      </form>

      {latest ? (
        <div className="rounded-lg border border-line bg-canvas p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">
            Just picked{latest.title ? `: ${latest.title}` : ''}
          </p>
          <p className="mt-1 font-semibold text-ink">
            {latest.people.map((p) => p.name).join(', ')}
          </p>
        </div>
      ) : null}

      {state.pickedIds.length > 0 ? (
        <form action={resetPicker}>
          <button
            type="submit"
            className="min-h-11 rounded-lg border border-line px-4 text-sm font-semibold text-ink"
          >
            Start the picker again ({state.pickedIds.length} picked)
          </button>
        </form>
      ) : null}
    </section>
  );
}
