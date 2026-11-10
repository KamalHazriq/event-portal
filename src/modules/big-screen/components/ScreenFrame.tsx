import { AutoRefresh } from '@/components/AutoRefresh';

import { SCREEN_POLL_MS } from '../logic';
import type { ScreenPayload } from '../load';
import {
  ArrivalsView,
  CountdownView,
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
  shortName,
  clock,
  testMode,
}: {
  payload: ScreenPayload;
  shortName: string;
  clock: string;
  testMode: boolean;
}) {
  return (
    <main
      id="main"
      className="screen-glow relative flex h-dvh w-full flex-col overflow-hidden px-[5vw] pb-[5vh] pt-[7vh]"
    >
      <AutoRefresh intervalMs={SCREEN_POLL_MS} />

      <div className="absolute inset-x-[5vw] top-[2.5vh] flex items-center justify-between text-[clamp(0.8rem,1.2vw,1.6rem)] text-ink-soft">
        <span className="font-semibold">{shortName}</span>
        <span className="tabular-nums">
          {testMode ? 'Test time ' : ''}
          {clock}
        </span>
      </div>

      {/* Keyed by view, so switching views fades the new one in. */}
      <div key={payload.view} className="min-h-0 flex-1">
        {payload.view === 'welcome' ? <WelcomeView {...payload.props} /> : null}
        {payload.view === 'now-next' ? <NowNextView {...payload.props} /> : null}
        {payload.view === 'arrivals' ? <ArrivalsView {...payload.props} /> : null}
        {payload.view === 'countdown' ? <CountdownView {...payload.props} /> : null}
        {payload.view === 'lucky-draw' ? <LuckyDrawView {...payload.props} /> : null}
        {payload.view === 'photos' ? <PhotosView {...payload.props} /> : null}
        {payload.view === 'qa' ? <QuestionsView {...payload.props} /> : null}
        {payload.view === 'poll' ? <PollView {...payload.props} /> : null}
      </div>
    </main>
  );
}
