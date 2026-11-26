import { stepCue } from '../actions';
import { SCREEN_VIEW_INFO, type ScreenView } from '@/modules/big-screen/logic';
import { cueNeighbours } from '../cues';
import { setScreenView } from '@/modules/big-screen/actions';
import type { ScreenSuggestion } from '@/modules/big-screen/suggest';

/**
 * The cue bar at the top of the stage console. Next cue and Previous cue are
 * manual presses (also the arrow keys and a presentation clicker). The agenda
 * only suggests: when it suggests something other than the next cue, that
 * gets its own button.
 */
export function CuePanel({
  current,
  available,
  suggestion,
  lastChange,
}: {
  current: ScreenView;
  available: ScreenView[];
  suggestion: ScreenSuggestion | null;
  lastChange: string | null;
}) {
  const { prev, next } = cueNeighbours(current, available);
  const suggestedElsewhere = suggestion && suggestion.view !== current ? suggestion : null;
  const onSuggested = suggestion && suggestion.view === current;

  return (
    <section
      aria-label="Cues"
      className="space-y-3 rounded-xl border-2 border-primary/50 bg-surface p-4"
    >
      <div className="flex flex-wrap items-center gap-3">
        <form action={stepCue}>
          <input type="hidden" name="dir" value="prev" />
          <button
            id="cue-prev"
            type="submit"
            disabled={!prev}
            className="min-h-14 rounded-xl border border-line px-5 text-left font-semibold text-ink disabled:opacity-40"
          >
            <span className="block text-xs uppercase tracking-wide text-ink-soft">
              Previous cue
            </span>
            ‹ {prev ? SCREEN_VIEW_INFO[prev].title : 'Start'}
          </button>
        </form>
        <p className="min-w-0 flex-1 text-center">
          <span className="block text-xs font-bold uppercase tracking-wide text-ink-soft">
            On the projector
          </span>
          <span className="text-xl font-bold text-ink">{SCREEN_VIEW_INFO[current].title}</span>
        </p>
        <form action={stepCue}>
          <input type="hidden" name="dir" value="next" />
          <button
            id="cue-next"
            type="submit"
            disabled={!next}
            className="min-h-14 rounded-xl bg-primary px-6 text-right font-bold text-on-primary disabled:opacity-40"
          >
            <span className="block text-xs uppercase tracking-wide opacity-80">Next cue</span>
            {next ? SCREEN_VIEW_INFO[next].title : 'End'} ›
          </button>
        </form>
      </div>

      {suggestedElsewhere ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-accent bg-accent/10 p-3">
          <p className="min-w-0 flex-1 text-sm text-ink">
            <span className="font-bold">
              Agenda suggests {SCREEN_VIEW_INFO[suggestedElsewhere.view].title}.
            </span>{' '}
            {suggestedElsewhere.reason}
          </p>
          <form action={setScreenView}>
            <input type="hidden" name="view" value={suggestedElsewhere.view} />
            <button
              type="submit"
              className="min-h-11 rounded-lg border border-accent px-4 font-bold text-ink"
            >
              Put it up
            </button>
          </form>
        </div>
      ) : onSuggested ? (
        <p className="rounded-lg border border-success bg-success/10 p-3 text-sm text-ink">
          The agenda agrees with what is on the screen. {suggestion?.reason}
        </p>
      ) : null}

      <p className="text-xs text-ink-soft">
        Keys on a laptop or clicker: → or Page Down is next cue, ← or Page Up is previous, 1 to 9
        pick a tile.
        {lastChange ? ` Last change: ${lastChange}.` : ''}
      </p>
    </section>
  );
}
