import { FormPending } from '@/components/FormPending';

import { clearAllButPhotos } from '../actions';

/**
 * "Clear everything except the photos and the participant list", for a fresh
 * start after testing. Shown on Admins, the Test plan and Photos, so it is
 * where the person looks; each sends you back to the page you pressed it on.
 */
export function ClearAllButPhotos({
  back,
  cleared,
  confirmProblem,
}: {
  /** The page to come back to, such as /admin/photos. */
  back: string;
  cleared?: boolean;
  confirmProblem?: boolean;
}) {
  return (
    <form
      id="clear-all"
      action={clearAllButPhotos}
      className="scroll-mt-24 space-y-3 rounded-xl border-2 border-live bg-surface p-4"
    >
      <FormPending label="Clearing" />
      <input type="hidden" name="back" value={back} />
      <p className="font-bold text-ink">
        Clear everything except the photos and the participant list
      </p>
      <p className="text-ink-soft">
        For a fresh start after testing. It clears check ins, points and the leaderboard, comments,
        reactions, feedback, lucky draw winners, Q&amp;A and poll votes, phone sign ins, door gift
        spins, name picker turns, announcements and scheduled messages. It keeps the photos, the
        participant list, the agenda and event info edits, the door gift stock and every setting. It
        cannot be undone.
      </p>
      {cleared ? (
        <p role="status" className="font-semibold text-success">
          Cleared. Everything starts again; the photos and the list are still there.
        </p>
      ) : confirmProblem ? (
        <p role="alert" className="font-semibold text-warning">
          Type CLEAR to confirm.
        </p>
      ) : null}
      <label className="block text-sm font-semibold text-ink">
        Type CLEAR to confirm
        <input
          name="confirm"
          autoComplete="off"
          className="mt-1 block min-h-11 w-full max-w-xs rounded-lg border border-line bg-canvas px-3 font-mono text-ink"
        />
      </label>
      <button type="submit" className="min-h-11 rounded-lg bg-live px-5 font-bold text-canvas">
        Clear everything except photos
      </button>
    </form>
  );
}
