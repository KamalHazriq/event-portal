/**
 * The four projector views. Server components: the page re-renders them on
 * every poll, so they need no JavaScript of their own except the countdown.
 *
 * Sized in viewport units so they fill a 1920 x 1080 projector and still read
 * from the back of a ballroom, and scale down sensibly on a laptop preview.
 * Every colour comes from the theme tokens.
 */
import { QrCode } from '@/components/QrCode';

import { LuckyDrawSpinner } from '@/modules/lucky-draw/components/LuckyDrawSpinner';
import { PhotoSlideshow } from '@/modules/photos/components/PhotoSlideshow';

import type { ArrivalCard } from '../logic';
import { CountdownDigits } from './CountdownDigits';

const LABEL =
  'text-[clamp(0.9rem,1.5vw,1.8rem)] font-bold uppercase tracking-[0.2em] text-ink-soft';

/* ---------------------------------------------------------------- welcome */

export function WelcomeView({
  name,
  tagline,
  dates,
  venue,
  portalUrl,
  logoPath,
}: {
  name: string;
  tagline: string;
  dates: string;
  venue: string;
  portalUrl: string;
  logoPath: string | null;
}) {
  return (
    <div className="screen-fade grid h-full grid-cols-1 items-center gap-[4vw] md:grid-cols-[1fr_auto]">
      <div className="min-w-0">
        {logoPath ? (
          // A plain img: the logo is a small local SVG and needs no optimiser.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoPath} alt="" className="mb-[4vh] h-auto w-[min(42vw,40rem)]" />
        ) : null}
        <h1 className="text-[clamp(2.5rem,6.5vw,9rem)] font-bold leading-[1.02] tracking-tight text-ink">
          {name}
        </h1>
        {tagline ? (
          <p className="mt-[2vh] text-[clamp(1.2rem,2.6vw,3.5rem)] leading-tight text-accent">
            {tagline}
          </p>
        ) : null}
        <p className="mt-[4vh] text-[clamp(1rem,1.8vw,2.4rem)] text-ink-soft">
          {dates}
          {venue ? ` / ${venue}` : ''}
        </p>
      </div>

      <div className="flex flex-col items-center">
        <div className="rounded-[1.5vw] bg-white p-[1.2vw] shadow-2xl">
          <QrCode
            value={portalUrl}
            label="QR code that opens the event portal"
            className="block size-[clamp(10rem,26vw,34rem)]"
          />
        </div>
        <p className="mt-[2vh] text-center text-[clamp(1rem,1.8vw,2.4rem)] font-bold text-ink">
          Scan for the agenda
        </p>
        <p className="max-w-[30vw] break-all text-center text-[clamp(0.8rem,1.1vw,1.5rem)] text-ink-soft">
          {portalUrl.replace(/^https?:\/\//, '')}
        </p>
      </div>
    </div>
  );
}

/* --------------------------------------------------------- now and next */

export type ScreenSession = {
  id: string;
  title: string;
  room: string;
  /** "2:30 pm". */
  start: string;
  end: string;
  speakers: string;
};

export function NowNextView({
  live,
  minutesLeft,
  next,
  minutesUntilNext,
  nextIsLaterDay,
  nextDayLabel,
  afterEventEnds,
}: {
  live: ScreenSession[];
  minutesLeft: number | null;
  next: ScreenSession | null;
  minutesUntilNext: number | null;
  nextIsLaterDay: boolean;
  nextDayLabel: string;
  afterEventEnds: boolean;
}) {
  if (live.length === 0 && !next) {
    return (
      <div className="screen-fade flex h-full flex-col items-center justify-center text-center">
        <p className="text-[clamp(2.5rem,6vw,8rem)] font-bold text-ink">
          {afterEventEnds ? 'Thank you for coming' : 'Nothing scheduled'}
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col justify-center gap-[5vh]">
      {live.length > 0 ? (
        <section key={live.map((s) => s.id).join()} className="screen-fade">
          <p className={LABEL}>
            <span className="live-dot mr-[0.6vw] inline-block size-[1vw] rounded-full bg-live align-middle" />
            On now
          </p>
          <div className={live.length > 1 ? 'mt-[2vh] grid grid-cols-3 gap-[2vw]' : 'mt-[1vh]'}>
            {live.map((s) => (
              <div key={s.id} className="min-w-0">
                <p
                  className={[
                    'font-bold leading-[1.05] tracking-tight text-ink',
                    live.length > 1
                      ? 'text-[clamp(1.5rem,3vw,4rem)]'
                      : 'text-[clamp(2.5rem,5.5vw,8rem)]',
                  ].join(' ')}
                >
                  {s.title}
                </p>
                <p className="mt-[1vh] text-[clamp(1rem,1.9vw,2.6rem)] text-ink-soft">
                  {[s.room, s.speakers].filter(Boolean).join(' / ')}
                </p>
                {live.length > 1 ? (
                  <p className="mt-[0.5vh] text-[clamp(1rem,1.6vw,2.2rem)] text-ink">
                    Until {s.end}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
          {live.length === 1 ? (
            <p className="mt-[2vh] text-[clamp(1.2rem,2.4vw,3.2rem)] text-ink">
              Until {live[0]?.end}
              {minutesLeft !== null ? (
                <span className="ml-[1.5vw] font-bold tabular-nums text-accent">
                  {minutesLeft} min left
                </span>
              ) : null}
            </p>
          ) : null}
        </section>
      ) : null}

      {next ? (
        <section
          key={next.id}
          className={[
            'screen-fade',
            live.length > 0 ? 'border-t-[0.3vh] border-line pt-[4vh]' : '',
          ].join(' ')}
        >
          <p className={LABEL}>{nextIsLaterDay ? nextDayLabel : 'Next'}</p>
          <p
            className={[
              'mt-[1vh] font-bold leading-[1.05] text-ink',
              live.length > 0
                ? 'text-[clamp(1.8rem,3.6vw,5rem)]'
                : 'text-[clamp(2.5rem,5.5vw,8rem)]',
            ].join(' ')}
          >
            {next.title}
          </p>
          <p className="mt-[1vh] text-[clamp(1.1rem,2.2vw,3rem)] text-ink-soft">
            {next.start}
            {next.room ? ` / ${next.room}` : ''}
            {minutesUntilNext !== null && minutesUntilNext > 0 ? (
              <span className="ml-[1.5vw] font-bold tabular-nums text-accent">
                in {minutesUntilNext} min
              </span>
            ) : null}
          </p>
        </section>
      ) : null}
    </div>
  );
}

/* --------------------------------------------------------------- arrivals */

export function ArrivalsView({
  arrived,
  expected,
  percent,
  dayLabel,
  cards,
  hideNames,
}: {
  arrived: number;
  expected: number;
  percent: number;
  dayLabel: string;
  cards: ArrivalCard[];
  hideNames: boolean;
}) {
  const counter = (
    <div className={hideNames ? 'text-center' : ''}>
      <p className={LABEL}>Arrived, {dayLabel}</p>
      <p className="mt-[1vh] font-bold leading-none tabular-nums text-ink">
        <span className="text-[clamp(5rem,16vw,22rem)]">{arrived}</span>
        <span className="text-[clamp(2rem,6vw,8rem)] text-ink-soft"> / {expected}</span>
      </p>
      <div
        className="mt-[3vh] h-[2vh] w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Arrivals so far"
      >
        <div
          className="screen-bar h-full rounded-full bg-accent"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );

  if (hideNames) {
    return <div className="mx-auto flex h-full w-[70vw] flex-col justify-center">{counter}</div>;
  }

  return (
    <div className="grid h-full grid-cols-[1fr_1.1fr] items-center gap-[5vw]">
      {counter}
      <ul className="space-y-[1.6vh]" aria-label="Latest arrivals">
        {cards.length === 0 ? (
          <li className="text-[clamp(1.2rem,2.2vw,3rem)] text-ink-soft">
            Welcome cards appear here as people check in.
          </li>
        ) : (
          cards.map((card, i) => (
            // Keyed by check in, so only a new arrival animates in.
            <li
              key={card.key}
              className="screen-arrive rounded-[1vw] border border-line bg-surface px-[2vw] py-[1.6vh]"
              style={{ opacity: i === 0 ? 1 : Math.max(0.45, 1 - i * 0.12) }}
            >
              <p className="text-[clamp(1.2rem,2.4vw,3.2rem)] font-bold leading-tight text-ink">
                Welcome, {card.name}
              </p>
              <p className="text-[clamp(0.9rem,1.5vw,2rem)] text-ink-soft">{card.department}</p>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

/* -------------------------------------------------------------- countdown */

export function CountdownView({ label, targetMs }: { label: string; targetMs: number | null }) {
  return (
    <div className="screen-fade flex h-full flex-col items-center justify-center text-center">
      <p className="text-[clamp(1.5rem,3.4vw,4.5rem)] font-bold text-accent">{label}</p>
      {targetMs !== null ? (
        <CountdownDigits
          targetMs={targetMs}
          className="mt-[2vh] block font-bold leading-none tabular-nums tracking-tight text-ink"
        />
      ) : (
        <p className="mt-[2vh] text-[clamp(2rem,4vw,5rem)] text-ink-soft">Stay tuned</p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------- lucky draw */

export function LuckyDrawView({
  latest,
  spinNames,
  inHat,
}: {
  latest: {
    drawId: string;
    prize: string;
    drawnAtMs: number;
    winners: { key: string; name: string; department: string }[];
  } | null;
  spinNames: string[];
  inHat: number;
}) {
  if (!latest) {
    return (
      <div className="screen-fade flex h-full flex-col items-center justify-center text-center">
        <p className="text-[clamp(2.5rem,7vw,10rem)] font-bold text-ink">Lucky draw</p>
        <p className="mt-[2vh] text-[clamp(1.2rem,2.6vw,3.5rem)] text-ink-soft">
          {inHat} {inHat === 1 ? 'name' : 'names'} in the hat
        </p>
      </div>
    );
  }

  return (
    // Keyed by draw, so a new draw mounts a fresh spinner.
    <LuckyDrawSpinner
      key={latest.drawId}
      prize={latest.prize}
      drawnAtMs={latest.drawnAtMs}
      winners={latest.winners}
      spinNames={[...new Set([...spinNames, ...latest.winners.map((w) => w.name)])]}
    />
  );
}

/* ----------------------------------------------------------------- photos */

export function PhotosView({
  slides,
  shareUrl,
}: {
  slides: { id: string; caption: string }[];
  shareUrl: string;
}) {
  if (slides.length === 0) {
    return (
      <div className="screen-fade grid h-full items-center gap-[4vw] md:grid-cols-[1fr_auto]">
        <div>
          <p className="text-[clamp(2.5rem,6vw,9rem)] font-bold leading-[1.05] text-ink">
            Share your photos
          </p>
          <p className="mt-[2vh] text-[clamp(1.2rem,2.4vw,3.2rem)] text-ink-soft">
            Scan, pick a photo, and it appears here once an organiser has checked it.
          </p>
        </div>
        <div className="rounded-[1.5vw] bg-white p-[1.2vw]">
          <QrCode
            value={shareUrl}
            label="QR code that opens the photo sharing page"
            className="block size-[clamp(9rem,22vw,28rem)]"
          />
        </div>
      </div>
    );
  }
  return <PhotoSlideshow slides={slides} />;
}
