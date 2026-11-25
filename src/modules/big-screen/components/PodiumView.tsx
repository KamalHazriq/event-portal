'use client';

import { useEffect, useRef, useState } from 'react';

import { playDrumRoll, playFanfare, playImpact, playPing } from '@/modules/lucky-draw/sound';
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
  // What is on screen lags what the MC pressed, so a drum roll can build first.
  const [shown, setShown] = useState(revealed);
  const [suspense, setSuspense] = useState<number | null>(null); // rank being rolled for
  const [flash, setFlash] = useState(0); // counts up on each hit, to restart the flash
  const [shake, setShake] = useState(false);
  const roll = useRef<number | null>(null);
  const mounted = useRef(true);

  const firstShown = places.length - shown; // index of the first revealed place
  const isOut = (i: number) => i >= firstShown;
  const winnerOut = shown >= places.length && places.length > 0;

  useEffect(() => {
    if (mounted.current) {
      mounted.current = false; // a reloaded projector shows where it was, quietly
      return;
    }
    if (revealed === shown || suspense !== null) return; // caught up, or already rolling
    // Every change of state happens in a timer callback, never in the effect body.
    if (revealed < shown) {
      const t = window.setTimeout(() => setShown(revealed), 0);
      return () => window.clearTimeout(t);
    }
    const next = places[places.length - shown - 1];
    const rank = next?.rank ?? 99;
    if (!next || calm || rank > 3) {
      const t = window.setTimeout(() => {
        if (next && !calm) playPing(rank);
        setShown(next ? shown + 1 : revealed);
      }, 0);
      return () => window.clearTimeout(t);
    }
    // A podium step: roll the drums, then reveal. The winner's roll is the longest.
    const seconds = rank === 1 ? 4.6 : rank === 2 ? 2.8 : 2.2;
    const start = window.setTimeout(() => {
      setSuspense(rank);
      playDrumRoll(seconds, rank === 1);
      roll.current = window.setTimeout(() => {
        playImpact(rank === 1);
        if (rank === 1) window.setTimeout(playFanfare, 350);
        setSuspense(null);
        setShown((n) => n + 1);
        setFlash((n) => n + 1);
        setShake(true);
        window.setTimeout(() => setShake(false), rank === 1 ? 1100 : 600);
      }, seconds * 1000);
    }, 0);
    return () => window.clearTimeout(start);
  }, [revealed, shown, suspense, places, calm]);

  useEffect(
    () => () => {
      if (roll.current !== null) window.clearTimeout(roll.current);
    },
    [],
  );

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
    ? { 1: 'h-[17vh]', 2: 'h-[12vh]', 3: 'h-[8vh]' }
    : { 1: 'h-[26vh]', 2: 'h-[18vh]', 3: 'h-[12vh]' };
  const fx = calm ? '' : 'podium-fx';

  // Podium order: 2nd, 1st, 3rd, the way it stands. A tie can leave a gap.
  const standing = [2, 1, 3]
    .map((rank) => top.find(({ p }) => p.rank === rank))
    .filter((x): x is { p: PodiumPlace; i: number } => x !== undefined);

  return (
    <div
      className={`screen-fade relative flex h-full flex-col overflow-hidden ${shake && !calm ? 'podium-shake' : ''}`}
    >
      {winnerOut && !calm ? <Confetti /> : null}
      {/* The room goes dark while the drums roll, brightest on the winner's. */}
      {suspense !== null && !calm ? (
        <div
          aria-hidden="true"
          className={`podium-dim pointer-events-none absolute inset-0 z-10 ${suspense === 1 ? 'podium-dim-winner' : ''}`}
        />
      ) : null}
      {flash > 0 && !calm ? (
        <div
          key={flash}
          aria-hidden="true"
          className="podium-flash pointer-events-none absolute inset-0 z-20 bg-white"
        />
      ) : null}
      <h2 className="text-center text-[clamp(1.4rem,min(3.2vw,5.5vh),4.2rem)] font-bold leading-tight text-ink">
        Top {size} best participants
      </h2>

      {/* The podium takes the space above; the box for 4th and down sits at the bottom. */}
      <ol
        className={`mt-[1vh] flex min-h-0 flex-1 items-end justify-center gap-[1.6vw] ${hasRest ? '' : 'pb-[3vh]'}`}
      >
        {standing.map(({ p: place, i }) => {
          const out = isOut(i);
          const crowd = place.people.length;
          const first = place.rank === 1;
          const width = standing.length === 1 ? 'w-[60%]' : 'w-[30%]';
          const size =
            crowd > 6
              ? 'text-[clamp(0.85rem,min(1.6vw,2.6vh),2.2rem)]'
              : crowd > 2
                ? 'text-[clamp(1rem,min(1.9vw,3.2vh),2.6rem)]'
                : first
                  ? 'text-[clamp(1.3rem,min(2.8vw,5vh),3.8rem)]'
                  : 'text-[clamp(1.1rem,min(2.3vw,4.2vh),3.2rem)]';
          const cols = crowd > 6 ? 'grid-cols-3' : crowd > 2 ? 'grid-cols-2' : 'grid-cols-1';
          return (
            <li key={place.rank} className={`flex flex-col justify-end ${width}`}>
              <div className={`mb-[1vh] text-center ${hasRest ? 'min-h-[9vh]' : 'min-h-[11vh]'}`}>
                {out ? (
                  <div className={out ? `${fx} podium-pop` : ''} key={`out-${place.rank}`}>
                    {first ? (
                      <p
                        aria-hidden="true"
                        className={`text-[clamp(1.5rem,min(3.2vw,5vh),4.5rem)] leading-none ${calm ? '' : 'crown-bob'}`}
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
                    <p className="mt-[0.5vh] text-[clamp(0.85rem,min(1.5vw,2.6vh),2.2rem)] text-ink-soft">
                      {place.points} points{crowd > 1 ? `, ${crowd} tied` : ''}
                    </p>
                  </div>
                ) : (
                  <p
                    className={`pt-[4vh] text-[clamp(1.4rem,min(3vw,5vh),4.2rem)] font-bold ${
                      suspense === place.rank && !calm
                        ? 'podium-suspense relative z-20 text-primary'
                        : 'text-ink-soft'
                    }`}
                  >
                    ?
                  </p>
                )}
              </div>
              <div
                className={[
                  'flex items-center justify-center gap-[0.6vw] rounded-t-xl text-[clamp(1.2rem,min(3.2vw,5.5vh),4.4rem)] font-bold leading-none',
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
        <div className="mt-auto shrink-0 rounded-2xl border border-line bg-surface p-[0.8vw]">
          <ol className="grid content-start gap-x-[1.2vw] gap-y-[0.5vh] md:grid-cols-2">
            {/* One row for each person: three tied for 8th show 8th three times. */}
            {rest.flatMap(({ p: place, i }) => {
              const out = isOut(i);
              return place.people.map((person) => (
                <li
                  key={`${place.rank}-${person.id}`}
                  className={[
                    'flex items-center gap-[1vw] rounded-lg px-[1vw] py-[0.5vh]',
                    out ? `bg-muted ${fx} row-in` : 'bg-transparent',
                  ].join(' ')}
                >
                  <span className="w-[4.5vw] shrink-0 text-[clamp(1rem,min(1.8vw,3vh),2.4rem)] font-bold tabular-nums text-primary">
                    {place.rank}
                  </span>
                  {out ? (
                    <>
                      <span className="min-w-0 flex-1 truncate text-[clamp(0.95rem,min(1.6vw,2.7vh),2.1rem)] font-semibold text-ink">
                        {person.name}
                      </span>
                      <span className="shrink-0 text-[clamp(0.85rem,min(1.3vw,2.2vh),1.8rem)] tabular-nums text-ink-soft">
                        {place.points} pts
                      </span>
                    </>
                  ) : (
                    <span className="text-[clamp(0.95rem,min(1.6vw,2.7vh),2.1rem)] text-ink-soft/60">
                      ?
                    </span>
                  )}
                </li>
              ));
            })}
          </ol>
        </div>
      ) : null}
    </div>
  );
}
