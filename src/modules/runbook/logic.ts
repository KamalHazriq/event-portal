/**
 * The event-day runbook: what the projector shows and what the secretariat
 * does, session by session, worked out from the agenda in the config. So the
 * plan stays right when the agenda changes.
 *
 * During a talk the main screen normally shows the speaker's slides. The
 * portal's views fill the gaps: registration, breaks, meals, the evening.
 *
 * Pure functions only. See logic.test.ts.
 */
import type { ScreenView } from '@/modules/big-screen/logic';

export type PlanSession = {
  id: string;
  title: string;
  type: string;
  start: string;
  end: string;
  qaEnabled: boolean;
  feedbackEnabled: boolean;
};

export type PlanStep = {
  sessionId: string;
  time: string;
  title: string;
  /** The projector view, or null when the speaker's slides are up. */
  view: ScreenView | null;
  /** What to do, in a few words. */
  actions: string[];
};

export type PlanFeatures = {
  reactions?: boolean;
  comments?: boolean;
  leaderboard?: boolean;
  luckyDraw?: boolean;
  photoWall?: boolean;
  arrivalWall?: boolean;
  feedback?: boolean;
};

const EVENING = '18:00';

/** One day's plan. `surpriseAt` is "HH:mm" on this day, if the countdown lands today. */
export function planDay(
  sessions: PlanSession[],
  features: PlanFeatures,
  options: { isLastDay: boolean; surpriseAt?: string } = { isLastDay: false },
): PlanStep[] {
  const ordered = [...sessions].sort((a, b) => a.start.localeCompare(b.start));
  const lastTalk = [...ordered].reverse().find((s) => s.type === 'talk' || s.type === 'panel');

  return ordered.map((s) => {
    const actions: string[] = [];
    let view: ScreenView | null = null;
    const isTalk = s.type === 'talk' || s.type === 'panel';

    if (s.type === 'logistics' && /regist/i.test(s.id + s.title)) {
      view = features.arrivalWall ? 'arrivals' : 'welcome';
      actions.push('Desks check people in: business card, or search by name');
    } else if (isTalk) {
      view = null;
      actions.push("Speaker's slides on the main screen");
      if (features.reactions) actions.push('Reactions are open while it runs');
      if (s.qaEnabled) actions.push('Q&A on Slido');
      if (features.comments && s.qaEnabled) {
        actions.push('Afterwards: approve comments, show the Comments view in the changeover');
      }
      if (features.feedback && s.feedbackEnabled) actions.push('Remind people: rate this session');
      if (options.isLastDay && lastTalk?.id === s.id && features.leaderboard) {
        actions.push('After it: Leaderboard view, announce the top people and department');
      }
    } else if (s.type === 'breakout') {
      view = 'now-next';
      actions.push('Rooms on screen so people find their breakout');
    } else if (s.type === 'meal' || s.type === 'break') {
      if (s.start >= EVENING && features.luckyDraw) {
        view = features.photoWall ? 'photos' : 'welcome';
        actions.push('Photo slideshow; lucky draw when the MC calls it');
      } else {
        view = features.photoWall ? 'photos' : 'now-next';
        actions.push('Approve photos as they come in');
        if (features.leaderboard) actions.push('Mid break: Leaderboard view for a minute');
      }
    } else if (s.type === 'activity' && s.start >= EVENING) {
      view = features.photoWall ? 'photos' : 'welcome';
      if (features.luckyDraw) actions.push('Lucky draw view when the MC calls it');
    } else {
      view = 'now-next';
    }

    if (options.surpriseAt && s.start <= options.surpriseAt && options.surpriseAt < s.end) {
      actions.unshift(`Countdown view before ${options.surpriseAt}`);
    }

    return { sessionId: s.id, time: `${s.start} to ${s.end}`, title: s.title, view, actions };
  });
}
