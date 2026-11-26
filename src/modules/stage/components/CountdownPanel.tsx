import { getData } from '@/data';
import { getEventConfig } from '@/lib/config';
import { updateCountdown, updateCountdownLabel } from '@/modules/admin/actions';
import { CountdownClock } from '@/modules/admin/components/CountdownClock';
import {
  QUICK_COUNTDOWNS,
  resolveSurprise,
  SURPRISE_KEYS,
  surpriseInstant,
} from '@/modules/admin/logic';

/**
 * The countdown, set from the stage console while it is on the projector:
 * start it in a few minutes, set an exact time, change the words, switch off.
 */
export async function CountdownPanel() {
  const config = getEventConfig();
  const data = getData();
  const [enabled, targetAt, label] = await Promise.all([
    data.settings.get(SURPRISE_KEYS.enabled),
    data.settings.get(SURPRISE_KEYS.targetAt),
    data.settings.get(SURPRISE_KEYS.label),
  ]);
  const surprise = resolveSurprise(config, { enabled, targetAt, label });
  const instant = surpriseInstant(surprise, config.event.timezone);

  return (
    <section className="space-y-3 rounded-xl border border-line bg-surface p-4">
      <h2 className="text-sm font-bold uppercase tracking-wide text-ink-soft">Countdown</h2>
      {surprise.enabled && instant ? (
        <div>
          <p className="text-ink">{surprise.label}</p>
          <p className="text-3xl font-bold leading-tight text-ink">
            <CountdownClock targetMs={instant.getTime()} />
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            Set for {surprise.targetAt?.replace('T', ' at ')}
          </p>
        </div>
      ) : (
        <p className="text-ink-soft">
          Off.{' '}
          {surprise.targetAt
            ? `The config file has it at ${surprise.targetAt.replace('T', ' at ')}.`
            : 'No time is set.'}
        </p>
      )}

      <div>
        <p className="mb-1 text-sm font-semibold text-ink">Start it in</p>
        <div className="flex flex-wrap gap-2">
          {QUICK_COUNTDOWNS.map((minutes) => (
            <form key={minutes} action={updateCountdown}>
              <input type="hidden" name="intent" value="quick" />
              <input type="hidden" name="minutes" value={minutes} />
              <button
                type="submit"
                className="min-h-12 rounded-lg border border-line bg-canvas px-4 font-bold text-ink hover:border-primary"
              >
                {minutes} min
              </button>
            </form>
          ))}
        </div>
      </div>

      <form action={updateCountdown} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="intent" value="exact" />
        <label className="text-sm font-semibold text-ink">
          Or an exact time
          <input
            name="targetAt"
            type="datetime-local"
            defaultValue={surprise.targetAt ?? ''}
            className="mt-1 block min-h-11 rounded-lg border border-line bg-canvas px-3 text-ink"
          />
        </label>
        <button
          type="submit"
          className="min-h-11 rounded-lg bg-primary px-4 font-bold text-on-primary"
        >
          Set
        </button>
      </form>

      <form action={updateCountdownLabel} className="flex flex-wrap items-end gap-2">
        <label className="min-w-0 flex-1 text-sm font-semibold text-ink">
          What the screen says above the numbers
          <input
            name="label"
            maxLength={80}
            defaultValue={surprise.label}
            className="mt-1 block min-h-11 w-full rounded-lg border border-line bg-canvas px-3 text-ink"
          />
        </label>
        <button
          type="submit"
          className="min-h-11 rounded-lg border border-line px-4 font-semibold text-ink"
        >
          Save
        </button>
      </form>

      <div className="flex flex-wrap gap-2 border-t border-line pt-3">
        <form action={updateCountdown}>
          <input type="hidden" name="intent" value="off" />
          <button
            type="submit"
            className="min-h-11 rounded-lg border border-line px-4 text-sm font-semibold text-ink"
          >
            Switch it off
          </button>
        </form>
        <form action={updateCountdown}>
          <input type="hidden" name="intent" value="reset" />
          <button
            type="submit"
            className="min-h-11 rounded-lg border border-line px-4 text-sm font-semibold text-ink-soft"
          >
            Back to the config file
          </button>
        </form>
      </div>
    </section>
  );
}
