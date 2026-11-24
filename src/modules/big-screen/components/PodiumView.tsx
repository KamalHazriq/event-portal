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
        <ol className="mt-[3vh] flex flex-1 items-end justify-center gap-[2vw]">
          {/* 2nd, 1st, 3rd, the way a podium stands. */}
          {[1, 0, 2]
            .filter((i) => i < places.length)
            .map((i) => {
              const place = places[i]!;
              const out = i >= shownFrom;
              const height =
                place.rank === 1 ? 'h-[70%]' : place.rank === 2 ? 'h-[55%]' : 'h-[42%]';
              return (
                <li key={place.rank} className={`flex w-[26%] flex-col justify-end ${height}`}>
                  <div className="mb-[1.5vh] text-center">
                    {out ? (
                      <div className="screen-fade">
                        {place.people.map((p) => (
                          <p
                            key={p.id}
                            className="text-[clamp(1.3rem,2.8vw,3.6rem)] font-bold text-ink"
                          >
                            {p.name}
                          </p>
                        ))}
                        <p className="text-[clamp(1rem,1.8vw,2.4rem)] text-ink-soft">
                          {place.points} points
                        </p>
                      </div>
                    ) : (
                      <p className="text-[clamp(1.6rem,3.4vw,4.4rem)] font-bold text-ink-soft">?</p>
                    )}
                  </div>
                  <div
                    className={[
                      'flex flex-1 items-start justify-center rounded-t-xl pt-[2vh] text-[clamp(2rem,5vw,6rem)] font-bold',
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
