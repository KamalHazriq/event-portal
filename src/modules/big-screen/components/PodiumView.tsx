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

/**
 * Kahoot style reveal. Places come in best first; the MC reveals them from the
 * bottom up with a button on /admin/big-screen. Each reveal ticks, the winner
 * brings confetti and a fanfare. Nothing plays on the first paint, so a
 * reloaded projector does not make noise.
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
  const shownFrom = places.length - revealed; // index of the first revealed place
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

  const podium = places.length <= 3;

  return (
    <div className="screen-fade relative flex h-full flex-col">
      {winnerOut && !calm ? <Confetti /> : null}
      <h2 className="text-[clamp(1.6rem,3vw,4rem)] font-bold text-ink">Top {size}</h2>

      {podium ? (
        <ol className="mt-[2vh] flex min-h-0 flex-1 items-end justify-center gap-[2vw]">
          {/* 2nd, 1st, 3rd, the way a podium stands. */}
          {[1, 0, 2]
            .filter((i) => i < places.length)
            .map((i) => {
              const place = places[i]!;
              const out = i >= shownFrom;
              const crowd = place.people.length;
              // The bar is a fixed height, so many people tied for one place can
              // never push it off the screen; they share a grid above it instead.
              const bar =
                place.rank === 1 ? 'h-[22vh]' : place.rank === 2 ? 'h-[15vh]' : 'h-[10vh]';
              const width =
                places.length === 1 ? 'w-[86%]' : places.length === 2 ? 'w-[42%]' : 'w-[28%]';
              const size =
                crowd > 8
                  ? 'text-[clamp(1rem,1.9vw,2.4rem)]'
                  : crowd > 3
                    ? 'text-[clamp(1.1rem,2vw,2.6rem)]'
                    : 'text-[clamp(1.3rem,2.8vw,3.6rem)]';
              const cols = crowd > 8 ? 'grid-cols-3' : crowd > 3 ? 'grid-cols-2' : 'grid-cols-1';
              return (
                <li key={place.rank} className={`flex min-h-0 flex-col justify-end ${width}`}>
                  <div className="mb-[1.5vh] min-h-0 text-center">
                    {out ? (
                      <div className="screen-fade">
                        <ul className={`grid gap-x-[1.5vw] gap-y-[0.6vh] ${cols}`}>
                          {place.people.map((p) => (
                            <li key={p.id} className={`font-bold leading-tight text-ink ${size}`}>
                              {p.name}
                            </li>
                          ))}
                        </ul>
                        <p className="mt-[0.8vh] text-[clamp(1rem,1.8vw,2.4rem)] text-ink-soft">
                          {place.points} points
                          {crowd > 1 ? `, ${crowd} tied` : ''}
                        </p>
                      </div>
                    ) : (
                      <p className="text-[clamp(1.6rem,3.4vw,4.4rem)] font-bold text-ink-soft">?</p>
                    )}
                  </div>
                  <div
                    className={[
                      'flex items-start justify-center rounded-t-xl pt-[1.5vh] text-[clamp(2rem,5vw,6rem)] font-bold',
                      bar,
                      out ? 'bg-primary text-on-primary' : 'bg-muted text-ink-soft',
                    ].join(' ')}
                  >
                    {ordinal(place.rank)}
                  </div>
                </li>
              );
            })}
        </ol>
      ) : (
        <ol className="mt-[2vh] flex flex-1 flex-col justify-end gap-[1vh]">
          {places.map((place, i) => {
            const out = i >= shownFrom;
            return (
              <li
                key={place.rank}
                className={[
                  'flex items-center gap-[2vw] rounded-lg border px-[2vw] py-[1vh]',
                  out ? 'screen-fade border-line bg-surface' : 'border-line bg-muted',
                  out && place.rank === 1 ? 'border-primary' : '',
                ].join(' ')}
              >
                <span className="w-[8vw] text-[clamp(1.4rem,3vw,4rem)] font-bold text-primary">
                  {ordinal(place.rank)}
                </span>
                {out ? (
                  <>
                    <span className="flex-1 text-[clamp(1.2rem,2.4vw,3.2rem)] font-bold text-ink">
                      {place.people.map((p) => p.name).join(', ')}
                    </span>
                    <span className="text-[clamp(1rem,1.8vw,2.4rem)] tabular-nums text-ink-soft">
                      {place.points} points
                    </span>
                  </>
                ) : (
                  <span className="text-[clamp(1.2rem,2.4vw,3.2rem)] text-ink-soft">?</span>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
