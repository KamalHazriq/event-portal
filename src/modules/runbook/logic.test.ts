import { describe, expect, it } from 'vitest';

import { planDay, type PlanSession } from './logic';

const s = (over: Partial<PlanSession>): PlanSession => ({
  id: 'x',
  title: 'X',
  type: 'talk',
  start: '09:00',
  end: '10:00',
  qaEnabled: false,
  feedbackEnabled: false,
  ...over,
});

const all = {
  reactions: true,
  comments: true,
  leaderboard: true,
  luckyDraw: true,
  photoWall: true,
  arrivalWall: true,
  feedback: true,
};

describe('planDay', () => {
  it('puts arrivals up for registration and slides up for talks', () => {
    const plan = planDay(
      [
        s({ id: 'reg', title: 'Registration', type: 'logistics', start: '08:00', end: '09:00' }),
        s({ id: 'talk', qaEnabled: true, feedbackEnabled: true }),
      ],
      all,
    );
    expect(plan[0]?.view).toBe('arrivals');
    expect(plan[1]?.view).toBeNull();
    expect(plan[1]?.actions.join(' ')).toMatch(/approve comments/);
    expect(plan[1]?.actions.join(' ')).toMatch(/rate this session/);
  });

  it('shows photos at breaks and the lucky draw in the evening', () => {
    const plan = planDay(
      [
        s({ id: 'tea', type: 'break', start: '10:00', end: '10:15' }),
        s({ id: 'dinner', type: 'meal', start: '19:00', end: '20:00' }),
      ],
      all,
    );
    expect(plan[0]?.view).toBe('photos');
    expect(plan[1]?.actions.join(' ')).toMatch(/lucky draw/i);
  });

  it('adds the countdown to the session it lands in, and the winners after the last talk', () => {
    const plan = planDay(
      [
        s({ id: 'last', start: '11:00', end: '12:00' }),
        s({ id: 'dinner', type: 'meal', start: '19:00', end: '21:00' }),
      ],
      all,
      { isLastDay: true, surpriseAt: '20:00' },
    );
    expect(plan[0]?.actions.join(' ')).toMatch(/Leaderboard view/);
    expect(plan[1]?.actions[0]).toBe('Countdown view before 20:00');
  });

  it('follows the switches: no photo wall means no photo view', () => {
    const plan = planDay([s({ id: 'tea', type: 'break' })], { ...all, photoWall: false });
    expect(plan[0]?.view).toBe('now-next');
  });
});
