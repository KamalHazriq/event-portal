/**
 * A nudge for the MC: what the projector could show right now, from the
 * clock and the agenda. It is only a suggestion: it never changes the screen
 * by itself, because there may be a reason for what is up. Pure functions
 * only. See suggest.test.ts.
 */
import type { EventNow } from '@/lib/time';
import { findNowAndNext, type Agenda } from '@/modules/schedule/logic';

import type { ScreenView } from './logic';

export type ScreenSuggestion = {
  view: ScreenView;
  /** One line: what is happening and what to put up. */
  reason: string;
};

export function suggestScreenView(
  agenda: Agenda,
  now: EventNow,
  available: ScreenView[],
): ScreenSuggestion | null {
  const has = (v: ScreenView) => available.includes(v);
  const state = findNowAndNext(agenda, now);
  const session = state.live[0];

  if (session) {
    if (session.type === 'meal' && has('photos')) {
      return {
        view: 'photos',
        reason: `${session.title} is on: show the photo wall while people eat.`,
      };
    }
    if (
      (session.type === 'break' || session.type === 'logistics') &&
      session.type === 'break' &&
      has('photos')
    ) {
      return { view: 'photos', reason: `${session.title}: a good time for the photo wall.` };
    }
    if (session.type === 'logistics' && has('arrivals')) {
      return { view: 'arrivals', reason: `${session.title}: show who is arriving.` };
    }
    if (session.type === 'activity' && has('now-next')) {
      return {
        view: 'now-next',
        reason: `${session.title}: keep Now and next up so everyone knows the plan.`,
      };
    }
    if (has('now-next')) {
      return {
        view: 'now-next',
        reason: `${session.title} is on: Now and next keeps the room oriented.`,
      };
    }
    return null;
  }

  if (state.beforeEventStarts && has('welcome')) {
    return {
      view: 'welcome',
      reason: 'Before the first session: the welcome screen, with the QR to join.',
    };
  }
  if (state.afterEventEnds && has('photos')) {
    return { view: 'photos', reason: 'The summit is over: the photo wall is a good last screen.' };
  }
  if (state.next && state.minutesUntilNext !== null && has('now-next')) {
    return {
      view: 'now-next',
      reason: `Between sessions, ${state.next.title} starts in ${state.minutesUntilNext} min: Now and next.`,
    };
  }
  return null;
}
