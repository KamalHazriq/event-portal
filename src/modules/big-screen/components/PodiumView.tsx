'use client';

import { useEffect, useRef } from 'react';

import { playFanfare, playTick } from '@/modules/lucky-draw/sound';
import { Confetti } from '@/modules/lucky-draw/components/LuckyDrawSpinner';

export type PodiumPlace = {
  rank: number;
  points: number;
  people: { id: string; name: string; department: string }[];
};

const ORDINAL: Record<number, string> = { 1: '1st', 2: '2nd', 3: '3rd' };
const ordinal = (n: number) => ORDINAL[n] ?? `${n}th`;
const MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

/**
 * Kahoot style reveal, all on one screen. The top three stand on a podium;
 * places 4 and below (for the top 5 or 10) sit in a box under it. The MC
 * reveals from the last place up with a button on /admin/big-screen. Each
 * reveal ticks and pops in, the winner brings confetti, a fanfare, a crown and
 * a glow. Nothing plays on first paint, so a reloaded projector stays quiet.
 */
export function PodiumView({
  places,
  revealed,
  size,
  calm,
}: {
  places: PodiumPlace[];
  revealed: number;
  size: number;
  calm: boolean;
}) {
  const previous = useRef<number | null>(null);
  const firstShown = places.length - revealed; // index of the first revealed place
  const isOut = (i: number) => i >= firstShown;
  const winnerOut = revealed >= places.length && places.length > 0;

  useEffect(() => {
    if (previous.current !== null && revealed > previous.current && !calm) {
      if (revealed >= places.length) playFanfare();
      else playTick();
    }
    previous.current = revealed;
  }, [revealed, places.length, calm]);

  if (places.length === 0) {
    return (
      <p className="screen-fade text-[clamp(1.2rem,2.4vw,3rem)] text-ink-soft">
        No points yet, so there is nothing to reveal.
      </p>
    );
  }

  const top = places.map((p, i) => ({ p, i })).filter(({ p }) => p.rank <= 3);
  const rest = places.map((p, i) => ({ p, i })).filter(({ p }) => p.rank > 3);
  const hasRest = rest.length > 0;
  // The podium is taller when it has the whole screen to itself.
  const bars: Record<number, string> = hasRest
    ? { 1: 'h-[20vh]', 2: 'h-[14vh]', 3: 'h-[10vh]' }
    : { 1: 'h-[26vh]', 2: 'h-[18vh]', 3: 'h-[12vh]' };
  const fx = calm ? '' : 'podium-fx';

  // Podium order: 2nd, 1st, 3rd, the way it stands. A tie can leave a gap.
  const standing = [2, 1, 3]
    .map((rank) => top.find(({ p }) => p.rank === rank))
    .filter((x): x is { p: PodiumPlace; i: number } => x !== undefined);

  return (
    <div className="screen-fade relative flex h-full flex-col overflow-hidden">
      {winnerOut && !calm ? <Confetti /> : null}
      <h2 className="text-center text-[clamp(1.6rem,3.2vw,4.2rem)] font-bold leading-tight text-ink">
        Top {size} best participants
      </h2>

      <ol
        className={`mt-[2vh] flex shrink-0 items-end justify-center gap-[1.6vw] ${hasRest ? '' : 'flex-1 pb-[3vh]'}`}
      >
        {standing.map(({ p: place, i }) => {
          const out = isOut(i);
          const crowd = place.people.length;
          const first = place.rank === 1;
          const width = standing.length === 1 ? 'w-[60%]' : 'w-[30%]';
          const size =
            crowd > 6
              ? 'text-[clamp(0.9rem,1.7vw,2.2rem)]'
              : crowd > 2
                ? 'text-[clamp(1.1rem,2vw,2.6rem)]'
                : first
                  ? 'text-[clamp(1.4rem,3vw,3.8rem)]'
                  : 'text-[clamp(1.2rem,2.5vw,3.2rem)]';
          const cols = crowd > 6 ? 'grid-cols-3' : crowd > 2 ? 'grid-cols-2' : 'grid-cols-1';
          return (
            <li key={place.rank} className={`flex flex-col justify-end ${width}`}>
              <div className="mb-[1.2vh] min-h-[11vh] text-center">
                {out ? (
                  <div className={out ? `${fx} podium-pop` : ''} key={`out-${place.rank}`}>
                    {first ? (
                      <p
                        aria-hidden="true"
                        className={`text-[clamp(2rem,4vw,5rem)] leading-none ${calm ? '' : 'crown-bob'}`}
                      >
                        👑
                      </p>
                    ) : null}
                    <ul className={`grid gap-x-[1.2vw] gap-y-[0.4vh] ${cols}`}>
                      {place.people.map((person) => (
                        <li key={person.id} className={`font-bold leading-tight text-ink ${size}`}>
                          {person.name}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-[0.5vh] text-[clamp(0.95rem,1.7vw,2.2rem)] text-ink-soft">
                      {place.points} points{crowd > 1 ? `, ${crowd} tied` : ''}
                    </p>
                  </div>
                ) : (
                  <p className="pt-[4vh] text-[clamp(1.6rem,3.2vw,4.2rem)] font-bold text-ink-soft">
                    ?
                  </p>
                )}
              </div>
              <div
                className={[
                  'flex items-center justify-center gap-[0.6vw] rounded-t-xl text-[clamp(1.4rem,3.4vw,4.4rem)] font-bold leading-none',
                  bars[place.rank],
                  out ? `bg-primary text-on-primary ${fx} podium-rise` : 'bg-muted text-ink-soft',
                  out && first && !calm ? 'winner-glow' : '',
                ].join(' ')}
              >
                <span aria-hidden="true" className="text-[0.8em]">
                  {out ? MEDAL[place.rank] : ''}
                </span>
                {ordinal(place.rank)}
              </div>
            </li>
          );
        })}
      </ol>

      {hasRest ? (
        <div className="mt-[1.5vh] shrink-0 rounded-2xl border border-line bg-surface p-[1.2vw]">
          <ol className="grid content-start gap-x-[1.5vw] gap-y-[0.8vh] md:grid-cols-2">
            {rest.map(({ p: place, i }) => {
              const out = isOut(i);
              return (
                <li
                  key={place.rank}
                  className={[
                    'flex items-center gap-[1vw] rounded-lg px-[1vw] py-[0.8vh]',
                    out ? `bg-muted ${fx} row-in` : 'bg-transparent',
                  ].join(' ')}
                >
                  <span className="w-[4.5vw] shrink-0 text-[clamp(1.1rem,2vw,2.6rem)] font-bold tabular-nums text-primary">
                    {place.rank}
                  </span>
                  {out ? (
                    <>
                      <span className="min-w-0 flex-1 truncate text-[clamp(1rem,1.8vw,2.3rem)] font-semibold text-ink">
                        {place.people.map((person) => person.name).join(', ')}
                      </span>
                      <span className="shrink-0 text-[clamp(0.9rem,1.5vw,2rem)] tabular-nums text-ink-soft">
                        {place.points} pts
                      </span>
                    </>
                  ) : (
                    <span className="text-[clamp(1rem,1.8vw,2.3rem)] text-ink-soft/60">?</span>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      ) : null}
    </div>
  );
}
