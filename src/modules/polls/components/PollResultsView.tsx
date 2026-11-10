import type { PollKind } from '@/data/types';

import { wordScale, type PollResults } from '../logic';

/**
 * Poll results as bars, or as a word cloud. Used on phones, the admin page
 * and the projector: "screen" sizes everything in viewport units so it reads
 * from the back of the room.
 */
export function PollResultsView({
  kind,
  results,
  size = 'page',
}: {
  kind: PollKind;
  results: PollResults;
  size?: 'page' | 'screen';
}) {
  const screen = size === 'screen';

  if (kind === 'wordcloud') {
    const most = Math.max(1, ...results.rows.map((r) => r.votes));
    if (results.rows.length === 0) {
      return <p className="text-ink-soft">No answers yet.</p>;
    }
    return (
      <p
        className={[
          'flex flex-wrap items-baseline justify-center text-center',
          screen ? 'gap-x-[2.5vw] gap-y-[1vh]' : 'gap-x-4 gap-y-1',
        ].join(' ')}
      >
        {results.rows.slice(0, screen ? 40 : 30).map((row, i) => {
          const scale = wordScale(row.votes, most);
          return (
            <span
              key={row.label}
              title={`${row.votes}`}
              className={[
                'font-bold leading-tight',
                i % 3 === 0 ? 'text-primary' : i % 3 === 1 ? 'text-accent' : 'text-ink',
              ].join(' ')}
              style={{ fontSize: screen ? `${1.4 + scale * 1.6}vw` : `${0.75 + scale * 0.5}rem` }}
            >
              {row.label}
            </span>
          );
        })}
      </p>
    );
  }

  const top = Math.max(1, ...results.rows.map((r) => r.votes));
  return (
    <ul className={screen ? 'space-y-[2.2vh]' : 'space-y-3'}>
      {results.rows.map((row) => {
        const leading = row.votes === top && row.votes > 0;
        return (
          <li key={row.label}>
            <div
              className={[
                'flex items-baseline justify-between gap-4',
                screen ? 'text-[clamp(1.1rem,2.2vw,3rem)]' : 'text-sm',
              ].join(' ')}
            >
              <span className={leading ? 'font-bold text-ink' : 'text-ink'}>{row.label}</span>
              <span className="shrink-0 tabular-nums text-ink-soft">
                <span className="font-bold text-ink">{row.votes}</span> ({row.percent}%)
              </span>
            </div>
            <div
              className={[
                'overflow-hidden rounded-full bg-muted',
                screen ? 'mt-[0.8vh] h-[2.4vh]' : 'mt-1 h-2.5',
              ].join(' ')}
            >
              <div
                className={[
                  'screen-bar h-full rounded-full',
                  leading ? 'bg-primary' : 'bg-accent',
                ].join(' ')}
                style={{ width: `${Math.round((row.votes / top) * 100)}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
