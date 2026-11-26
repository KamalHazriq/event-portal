'use client';

import { useEffect, useRef, useState } from 'react';

import { loopItemKey, SHOW_MS, type LoopCommand, type LoopItem } from '@/modules/loop/logic';

const LABEL =
  'text-[clamp(0.9rem,1.5vw,1.8rem)] font-bold uppercase tracking-[0.2em] text-ink-soft';

/**
 * The screensaver: one card at a time, each sliding in. A riddle shows its
 * question, then, after a pause, the answer. The server list is re-read every
 * few seconds, but this keeps its place, so nothing restarts.
 */
export function LoopView({
  items,
  calm,
  command,
}: {
  items: LoopItem[];
  calm: boolean;
  command?: LoopCommand;
}) {
  const [index, setIndex] = useState(0);
  const [answered, setAnswered] = useState(false);
  // Presses made before this screen opened are old news.
  const handled = useRef(command?.seq ?? 0);

  // The secretariat's buttons on the Big screen page.
  const seq = command?.seq ?? 0;
  const action = command?.action;
  const key = command?.key ?? '';
  const keys = items.map(loopItemKey).join('\n');
  useEffect(() => {
    if (seq === handled.current) return;
    handled.current = seq;
    const timer = window.setTimeout(() => {
      const total = keys ? keys.split('\n').length : 0;
      if (action === 'reveal') {
        setAnswered(true);
        return;
      }
      setAnswered(false);
      if (action === 'goto') {
        const at = keys.split('\n').indexOf(key);
        if (at >= 0) setIndex(at);
      } else if (action === 'prev') {
        setIndex((i) => (total > 0 ? (i - 1 + total * 1000) % total : 0));
      } else {
        setIndex((i) => i + 1);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [seq, action, key, keys]);
  const manual = command?.manual === true;

  const count = items.length;
  const item = count > 0 ? items[((index % count) + count) % count] : undefined;

  useEffect(() => {
    if (!item || manual) return;
    const timers: number[] = [];
    if (item.kind === 'riddle') {
      timers.push(window.setTimeout(() => setAnswered(true), SHOW_MS.riddleQuestion));
      timers.push(
        window.setTimeout(() => {
          setAnswered(false);
          setIndex((i) => i + 1);
        }, SHOW_MS.riddleQuestion + SHOW_MS.riddleAnswer),
      );
    } else {
      timers.push(
        window.setTimeout(
          () => setIndex((i) => i + 1),
          item.kind === 'fact' ? SHOW_MS.fact : SHOW_MS.lead,
        ),
      );
    }
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [item, index, manual]);

  if (!item) {
    return (
      <p className="text-[clamp(1.2rem,2.4vw,3rem)] text-ink-soft">
        The screensaver has nothing to show yet. Add riddles, facts or leads on the Screensaver
        page.
      </p>
    );
  }

  const fx = calm ? '' : 'loop-card';

  return (
    <div className="flex h-full items-center justify-center">
      <div key={`${index}-${item.kind}`} className={`${fx} w-full max-w-[84vw]`}>
        {item.kind === 'riddle' ? (
          <div className="text-center">
            <p className={LABEL}>Teka-teki</p>
            <p className="mt-[3vh] text-[clamp(2rem,5vw,6.5rem)] font-bold leading-tight text-ink">
              {item.q}
            </p>
            <div className="mt-[6vh] min-h-[14vh]">
              {/* Keyed, so each answer fades in slowly from nothing. */}
              <p
                key={answered ? 'a' : 'q'}
                className={`text-[clamp(1.8rem,4.4vw,5.6rem)] font-bold text-primary ${
                  answered ? (calm ? '' : 'loop-answer-slow') : 'invisible'
                }`}
              >
                {item.a}
              </p>
            </div>
          </div>
        ) : item.kind === 'fact' ? (
          <div className="text-center">
            <p className={LABEL}>Do you know?</p>
            <p className="mt-[3vh] text-[clamp(1.8rem,4.2vw,5.4rem)] font-bold leading-snug text-ink">
              {item.text}
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-[3vh] md:flex-row md:justify-center md:gap-[5vw]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/loop/photo/${item.id}`}
              alt={item.name}
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
              className="size-[clamp(12rem,34vh,26rem)] rounded-[2vw] object-cover shadow-2xl"
            />
            <div className="text-center md:text-left">
              <p className={LABEL}>Welcome to our new lead</p>
              <p className="mt-[1.5vh] text-[clamp(2.2rem,5.4vw,7rem)] font-bold leading-tight text-ink">
                {item.name}
              </p>
              {item.role ? (
                <p className="mt-[1vh] text-[clamp(1.2rem,2.6vw,3.4rem)] text-accent">
                  {item.role}
                </p>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
