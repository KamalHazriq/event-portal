import { setBackupMode } from './actions';

/**
 * The one switch that moves attendees from Slido to the portal's own Q&A and
 * polls. Shown on the Q&A, polls and live control pages, so it is never more
 * than one tap away if Slido fails mid session.
 */
export function BackupSwitch({ on }: { on: boolean }) {
  return (
    <section
      className={[
        'rounded-xl border-2 p-4',
        on ? 'border-success bg-surface' : 'border-dashed border-line bg-muted',
      ].join(' ')}
    >
      <p className="eyebrow">Backup mode</p>
      <p className="mt-1 text-lg font-bold text-ink">
        {on ? 'On: attendees are using the portal' : 'Off: attendees are using Slido'}
      </p>
      <p className="mt-1 text-sm text-ink-soft">
        {on
          ? 'Session pages show "Ask a question" and the home page offers the open poll, in place of the Slido button.'
          : 'Turn this on only if Slido is unavailable. You can prepare polls and try everything here while it is off; attendees see none of it.'}
      </p>
      <form action={setBackupMode} className="mt-3">
        <input type="hidden" name="mode" value={on ? 'off' : 'on'} />
        <button
          type="submit"
          className={
            on
              ? 'min-h-11 rounded-lg border border-line px-4 font-semibold text-ink'
              : 'min-h-11 rounded-lg bg-primary px-4 font-bold text-on-primary'
          }
        >
          {on ? 'Switch back to Slido' : 'Slido is down, switch to the portal'}
        </button>
      </form>
    </section>
  );
}
