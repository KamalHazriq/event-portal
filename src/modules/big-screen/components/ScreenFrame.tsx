import { AutoRefresh } from '@/components/AutoRefresh';

import { SCREEN_POLL_MS } from '../logic';
import type { ScreenPayload } from '../load';
import { ReactionOverlay } from './ReactionOverlay';
import {
  ArrivalsView,
  CommentsView,
  CountdownView,
  LeaderboardView,
  LuckyDrawView,
  NowNextView,
  PhotosView,
  PollView,
  QuestionsView,
  WelcomeView,
} from './ScreenViews';

/**
 * The full screen shell: the chosen view, plus a quiet corner with the event
 * name and the clock. Re-reads the server every few seconds.
 */
export function ScreenFrame({
  payload,
  reactions = [],
  banner = null,
  shortName,
  orgLogo = null,
  clock,
  testMode,
}: {
  payload: ScreenPayload;
  /** Recent taps from phones, floating up over the view. */
  reactions?: { id: string; emoji: string }[];
  /** The secretariat's announcement, shown across the foot of every view. */
  banner?: string | null;
  shortName: string;
  /** The organiser's logo (Digital & Information), top left on every view. */
  orgLogo?: { src: string; alt: string } | null;
  clock: string;
  testMode: boolean;
}) {
  return (
    <main
      id="main"
      className={`screen-glow relative flex h-dvh w-full flex-col overflow-hidden px-[5vw] pt-[9vh] ${banner ? 'pb-[16vh]' : 'pb-[5vh]'}`}
    >
      <AutoRefresh intervalMs={SCREEN_POLL_MS} />
      {/* The same calm navy backdrop behind every view. */}
      <div aria-hidden="true" className="screen-bg pointer-events-none absolute inset-0" />

      <div className="absolute inset-x-[5vw] top-[2.5vh] z-20 flex items-center justify-between text-[clamp(0.8rem,1.2vw,1.6rem)] text-ink-soft">
        <span className="flex items-center gap-[1vw]">
          {orgLogo ? (
            // On a white tile: the logo is blue, made for white.
            <span className="inline-flex rounded-[0.5vw] bg-white px-[0.7vw] py-[0.5vh]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={orgLogo.src}
                alt={orgLogo.alt}
                className="block h-[clamp(1.4rem,2.6vh,3rem)] w-auto"
              />
            </span>
          ) : null}
          <span className="font-semibold">{shortName}</span>
        </span>
        <span className="tabular-nums">
          {testMode ? 'Test time ' : ''}
          {clock}
        </span>
      </div>

      {/* Keyed by view, so switching views fades the new one in. */}
      <div key={payload.view} className="relative min-h-0 flex-1">
        {payload.view === 'welcome' ? <WelcomeView {...payload.props} /> : null}
        {payload.view === 'now-next' ? <NowNextView {...payload.props} /> : null}
        {payload.view === 'arrivals' ? <ArrivalsView {...payload.props} /> : null}
        {payload.view === 'countdown' ? <CountdownView {...payload.props} /> : null}
        {payload.view === 'lucky-draw' ? <LuckyDrawView {...payload.props} /> : null}
        {payload.view === 'photos' ? <PhotosView {...payload.props} /> : null}
        {payload.view === 'qa' ? <QuestionsView {...payload.props} /> : null}
        {payload.view === 'poll' ? <PollView {...payload.props} /> : null}
        {payload.view === 'leaderboard' ? <LeaderboardView {...payload.props} /> : null}
        {payload.view === 'comments' ? <CommentsView {...payload.props} /> : null}
      </div>
      {banner ? (
        // Keyed by the text, so a new announcement slides up again.
        <p
          key={banner}
          role="status"
          className="screen-banner absolute inset-x-[5vw] bottom-[3vh] z-30 rounded-[1vw] bg-primary px-[2.5vw] py-[2vh] text-[clamp(1.3rem,2.6vw,3.6rem)] font-bold leading-tight text-on-primary"
        >
          <span aria-hidden="true" className="mr-[1vw]">
            📣
          </span>
          {banner}
        </p>
      ) : null}
      <ReactionOverlay reactions={reactions} />
    </main>
  );
}
