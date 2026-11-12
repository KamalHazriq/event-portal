/**
 * The four projector views. Server components: the page re-renders them on
 * every poll, so they need no JavaScript of their own except the countdown.
 *
 * Sized in viewport units so they fill a 1920 x 1080 projector and still read
 * from the back of a ballroom, and scale down sensibly on a laptop preview.
 * Every colour comes from the theme tokens.
 */
import { QrCode } from '@/components/QrCode';
import { displayUrl } from '@/lib/event-pass';

import { LuckyDrawSpinner } from '@/modules/lucky-draw/components/LuckyDrawSpinner';
import type { PollKind } from '@/data/types';
import { PhotoSlideshow } from '@/modules/photos/components/PhotoSlideshow';
import { PollResultsView } from '@/modules/polls/components/PollResultsView';
import type { PollResults } from '@/modules/polls/logic';

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
          {displayUrl(portalUrl)}
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

/* -------------------------------------------------------------- questions */

function ScanTile({ url, label, caption }: { url: string; label: string; caption: string }) {
  return (
    <div className="flex shrink-0 flex-col items-center">
      <div className="rounded-[1.2vw] bg-white p-[1vw]">
        <QrCode value={url} label={label} className="block size-[clamp(7rem,16vw,22rem)]" />
      </div>
      <p className="mt-[1.5vh] text-center text-[clamp(0.9rem,1.5vw,2rem)] font-bold text-ink">
        {caption}
      </p>
    </div>
  );
}

export function QuestionsView({
  sessionTitle,
  askUrl,
  questions,
}: {
  sessionTitle: string;
  askUrl: string;
  questions: { id: string; text: string; name: string; votes: number; pinned: boolean }[];
}) {
  return (
    <div className="grid h-full grid-cols-[1fr_auto] items-center gap-[4vw]">
      <div className="min-w-0">
        <p className={LABEL}>Your questions</p>
        <p className="mt-[0.5vh] truncate text-[clamp(1rem,1.8vw,2.4rem)] text-ink-soft">
          {sessionTitle}
        </p>
        {questions.length === 0 ? (
          <p className="mt-[4vh] text-[clamp(2rem,4.5vw,6rem)] font-bold leading-tight text-ink">
            Scan to ask the first question
          </p>
        ) : (
          <ol className="mt-[3vh] space-y-[1.8vh]">
            {questions.map((q) => (
              <li
                key={q.id}
                className={[
                  'screen-arrive flex items-center gap-[2vw] rounded-[1vw] border bg-surface px-[2vw] py-[1.6vh]',
                  q.pinned ? 'border-[0.3vh] border-primary' : 'border-line',
                ].join(' ')}
              >
                <span className="w-[5vw] shrink-0 text-center text-[clamp(1.4rem,3vw,4rem)] font-bold tabular-nums text-accent">
                  {q.votes}
                </span>
                <span className="min-w-0">
                  <span className="line-clamp-2 text-[clamp(1.1rem,2.1vw,2.9rem)] font-bold leading-tight text-ink">
                    {q.text}
                  </span>
                  <span className="mt-[0.4vh] block text-[clamp(0.8rem,1.2vw,1.7rem)] text-ink-soft">
                    {q.name || 'Anonymous'}
                    {q.pinned ? ' / Being answered now' : ''}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
      <ScanTile
        url={askUrl}
        label="QR code that opens the questions page"
        caption="Scan to ask or vote"
      />
    </div>
  );
}

/* ------------------------------------------------------------------- poll */

export function PollView({
  poll,
  voteUrl,
}: {
  poll: {
    question: string;
    kind: PollKind;
    open: boolean;
    revealed: boolean;
    results: PollResults;
  } | null;
  voteUrl: string;
}) {
  if (!poll) {
    return (
      <div className="screen-fade flex h-full flex-col items-center justify-center text-center">
        <p className="text-[clamp(2.5rem,6vw,9rem)] font-bold text-ink">The next poll is coming</p>
      </div>
    );
  }

  return (
    <div
      className={
        poll.open
          ? 'grid h-full grid-cols-[1fr_auto] items-center gap-[4vw]'
          : 'flex h-full items-center'
      }
    >
      <div className="min-w-0 flex-1">
        <p className={LABEL}>{poll.open ? 'Poll open' : 'Poll results'}</p>
        <p className="mt-[1vh] text-[clamp(1.6rem,3.6vw,5rem)] font-bold leading-[1.08] text-ink">
          {poll.question}
        </p>
        <div className="mt-[4vh]">
          {poll.revealed ? (
            <PollResultsView kind={poll.kind} results={poll.results} size="screen" />
          ) : (
            <p className="text-[clamp(3rem,9vw,12rem)] font-bold leading-none tabular-nums text-ink">
              {poll.results.voters}
              <span className="ml-[1.5vw] text-[clamp(1.2rem,2.6vw,3.5rem)] font-normal text-ink-soft">
                {poll.results.voters === 1 ? 'answer so far' : 'answers so far'}
              </span>
            </p>
          )}
        </div>
      </div>
      {poll.open ? (
        <ScanTile url={voteUrl} label="QR code that opens the poll" caption="Scan to answer" />
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------ leaderboard */

export function LeaderboardView({
  people,
  departments,
  joinUrl,
}: {
  people: { id: string; rank: number; name: string; department: string; points: number }[];
  departments: { department: string; rank: number; average: number }[];
  joinUrl: string;
}) {
  const best = departments[0]?.average || 1;
  return (
    <div className="screen-fade grid h-full gap-[3vw] lg:grid-cols-[1.4fr_1fr_auto]">
      <section className="min-h-0">
        <h2 className="text-[clamp(1.4rem,2.6vw,3.6rem)] font-bold text-ink">Leaderboard</h2>
        {people.length === 0 ? (
          <p className="mt-[2vh] text-[clamp(1.1rem,2vw,2.8rem)] text-ink-soft">
            No points yet. Scan to join, then take part.
          </p>
        ) : (
          <ol className="mt-[2vh] space-y-[0.8vh]">
            {people.map((row) => (
              <li
                key={row.id}
                className="flex items-center gap-[1.2vw] rounded-[1vw] border border-line bg-surface px-[1.2vw] py-[0.5vh]"
              >
                <span
                  className={`flex size-[clamp(2rem,3vw,4rem)] shrink-0 items-center justify-center rounded-full text-[clamp(1rem,1.8vw,2.4rem)] font-bold tabular-nums ${
                    row.rank <= 3 ? 'bg-primary text-on-primary' : 'bg-muted text-ink'
                  }`}
                >
                  {row.rank}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[clamp(1rem,1.6vw,2.2rem)] font-bold text-ink">
                    {row.name}
                  </span>
                  <span className="block text-[clamp(0.8rem,1.05vw,1.4rem)] text-ink-soft">
                    {row.department}
                  </span>
                </span>
                <span className="text-[clamp(1.2rem,2vw,2.8rem)] font-bold tabular-nums text-ink">
                  {row.points}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="min-h-0">
        <h2 className="text-[clamp(1.4rem,2.6vw,3.6rem)] font-bold text-ink">Departments</h2>
        <ol className="mt-[2vh] space-y-[1.6vh]">
          {departments.map((row) => (
            <li key={row.department}>
              <div className="flex items-baseline justify-between gap-[1vw] text-[clamp(1rem,1.7vw,2.4rem)]">
                <span className="font-bold text-ink">
                  {row.rank}. {row.department}
                </span>
                <span className="tabular-nums text-ink-soft">{row.average}</span>
              </div>
              <div className="mt-[0.6vh] h-[1vh] overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${Math.round((row.average / best) * 100)}%` }}
                />
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-[2vh] text-[clamp(0.8rem,1.1vw,1.5rem)] text-ink-soft">
          Average points per person on the list.
        </p>
      </section>

      <ScanTile
        url={joinUrl}
        label="QR code that opens the leaderboard sign in"
        caption="Scan to join"
      />
    </div>
  );
}

/* --------------------------------------------------------------- comments */

export function CommentsView({
  sessionTitle,
  comments,
  commentUrl,
}: {
  sessionTitle: string;
  comments: { id: string; text: string; name: string; likes: number }[];
  commentUrl: string;
}) {
  return (
    <div className="screen-fade grid h-full gap-[3vw] lg:grid-cols-[1fr_auto]">
      <section className="min-h-0">
        <p className="text-[clamp(0.9rem,1.4vw,2rem)] font-semibold text-ink-soft">
          {sessionTitle}
        </p>
        <h2 className="text-[clamp(1.6rem,3vw,4.2rem)] font-bold text-ink">
          What people are saying
        </h2>
        {comments.length === 0 ? (
          <p className="mt-[3vh] text-[clamp(1.2rem,2.2vw,3rem)] text-ink-soft">
            No comments yet. Scan to add yours.
          </p>
        ) : (
          <ul className="mt-[3vh] space-y-[1.6vh]">
            {comments.map((c) => (
              <li
                key={c.id}
                className="rounded-[1vw] border border-line bg-surface px-[1.6vw] py-[1.4vh]"
              >
                <p className="text-[clamp(1.1rem,1.9vw,2.6rem)] font-semibold leading-snug text-ink">
                  {c.text}
                </p>
                <p className="mt-[0.6vh] flex justify-between text-[clamp(0.8rem,1.2vw,1.6rem)] text-ink-soft">
                  <span>{c.name || 'Anonymous'}</span>
                  <span className="tabular-nums">👍 {c.likes}</span>
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
      <ScanTile
        url={commentUrl}
        label="QR code that opens the talk to comment"
        caption="Scan to comment"
      />
    </div>
  );
}
