import { sendLoopCommand } from '../actions';
import { loopItemKey, type LoopItem } from '../logic';

const KIND_LABEL = { riddle: 'Riddle', fact: 'Fact', lead: 'Lead' } as const;

function label(item: LoopItem): string {
  return item.kind === 'riddle' ? item.q : item.kind === 'fact' ? item.text : item.name;
}

function Press({
  action,
  children,
  primary = false,
  keyValue,
}: {
  action: string;
  children: React.ReactNode;
  primary?: boolean;
  keyValue?: string;
}) {
  return (
    <form action={sendLoopCommand}>
      <input type="hidden" name="action" value={action} />
      {keyValue ? <input type="hidden" name="key" value={keyValue} /> : null}
      <button
        type="submit"
        className={`min-h-11 rounded-lg px-5 font-bold ${
          primary ? 'bg-primary text-on-primary' : 'border border-line font-semibold text-ink'
        }`}
      >
        {children}
      </button>
    </form>
  );
}

/**
 * The screensaver's remote, shown on the Big screen page only while the
 * screensaver is on the projector: reveal the answer, move between cards, or
 * pick one riddle, fact or lead to show.
 */
export function LoopControls({ items, manual }: { items: LoopItem[]; manual: boolean }) {
  return (
    <section className="space-y-3 rounded-xl border border-line bg-surface p-4">
      <h2 className="text-sm font-bold uppercase tracking-wide text-ink-soft">
        Screensaver controls
      </h2>
      <p className="text-sm text-ink-soft">
        {manual
          ? 'Hands-on: the screen stays on a card until you press Next, and a riddle waits for Reveal answer.'
          : 'Automatic: a riddle shows its answer after 9 seconds, then the next card follows. The buttons still work.'}
      </p>
      <div className="flex flex-wrap gap-2">
        <Press action="reveal" primary>
          Reveal answer
        </Press>
        <Press action="prev">‹ Previous</Press>
        <Press action="next">Next ›</Press>
        <Press action={manual ? 'manual-off' : 'manual-on'}>
          {manual ? 'Go back to automatic' : 'Hands-on: I will move it'}
        </Press>
      </div>
      {items.length > 0 ? (
        <details>
          <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-primary">
            Choose a riddle, fact or lead to show ({items.length})
          </summary>
          <ul className="mt-2 max-h-96 space-y-1 overflow-y-auto">
            {items.map((item) => (
              <li key={loopItemKey(item)}>
                <form action={sendLoopCommand} className="flex items-center gap-2">
                  <input type="hidden" name="action" value="goto" />
                  <input type="hidden" name="key" value={loopItemKey(item)} />
                  <span className="w-14 shrink-0 text-xs font-bold uppercase text-ink-soft">
                    {KIND_LABEL[item.kind]}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-ink">{label(item)}</span>
                  <button
                    type="submit"
                    className="min-h-10 shrink-0 rounded-lg border border-line px-3 text-sm font-semibold text-ink hover:border-primary"
                  >
                    Show
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
