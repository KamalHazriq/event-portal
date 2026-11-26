import { getData } from '@/data';
import { controlPoll } from '@/modules/backup/actions';
import { PollResultsView } from '@/modules/polls/components/PollResultsView';
import { tallyPoll } from '@/modules/polls/logic';

function Press({
  id,
  act,
  label,
  primary = false,
}: {
  id: string;
  act: string;
  label: string;
  primary?: boolean;
}) {
  return (
    <form action={controlPoll}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="act" value={act} />
      <button
        type="submit"
        className={
          primary
            ? 'min-h-12 rounded-lg bg-primary px-5 font-bold text-on-primary'
            : 'min-h-12 rounded-lg border border-line px-4 font-semibold text-ink'
        }
      >
        {label}
      </button>
    </form>
  );
}

const STATUS = { draft: 'Ready', open: 'Open for answers', closed: 'Closed' } as const;

/** Polls on the stage console: open, close, reveal the results, put one on the screen. */
export async function PollPanel() {
  const data = getData();
  const polls = await data.polls.list();
  const votes = await Promise.all(polls.map((p) => data.polls.votes(p.id)));
  const results = polls.map((p, i) => tallyPoll(p, votes[i] ?? []));

  return (
    <section className="space-y-3 rounded-xl border border-line bg-surface p-4">
      <h2 className="text-sm font-bold uppercase tracking-wide text-ink-soft">Polls</h2>
      {polls.length === 0 ? (
        <p className="text-ink-soft">No polls yet. Write or load them on the Polls page.</p>
      ) : (
        <ul className="space-y-3">
          {polls.map((poll, i) => {
            const r = results[i];
            return (
              <li
                key={poll.id}
                className={[
                  'rounded-lg bg-canvas p-3',
                  poll.status === 'open' ? 'border-2 border-success' : 'border border-line',
                ].join(' ')}
              >
                <p className="font-bold text-ink">{poll.question}</p>
                <p className="text-sm text-ink-soft">
                  {STATUS[poll.status]}. {r?.voters ?? 0} answered.{' '}
                  {poll.revealed ? 'Results showing.' : 'Results hidden.'}
                </p>
                {poll.status === 'open' && r ? (
                  <div className="mt-2">
                    <PollResultsView kind={poll.kind} results={r} />
                  </div>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  {poll.status === 'open' ? (
                    <Press id={poll.id} act="close" label="Close" primary />
                  ) : (
                    <Press
                      id={poll.id}
                      act="open"
                      label={poll.status === 'closed' ? 'Reopen' : 'Open'}
                      primary
                    />
                  )}
                  {poll.revealed ? (
                    <Press id={poll.id} act="conceal" label="Hide results" />
                  ) : (
                    <Press id={poll.id} act="reveal" label="Reveal results" />
                  )}
                  <Press id={poll.id} act="screen" label="Put on the screen" />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
