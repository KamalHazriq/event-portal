import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { buildAgenda } from '@/modules/schedule/logic';
import { EventConfigSchema } from '@/lib/event-schema';

import { SCREEN_VIEWS } from './logic';
import { suggestScreenView } from './suggest';

const agenda = buildAgenda(
  EventConfigSchema.parse(JSON.parse(readFileSync('config/event.test.json', 'utf8'))),
);
const at = (date: string, hhmm: string) => {
  const [h = 0, m = 0] = hhmm.split(':').map(Number);
  return { date, minutes: h * 60 + m, isOverride: true };
};

describe('the screen suggestion', () => {
  it('suggests the photo wall at lunch', () => {
    const lunch = agenda.sessions.find((s) => s.type === 'meal')!;
    const got = suggestScreenView(agenda, at(lunch.date, lunch.start), [...SCREEN_VIEWS]);
    expect(got?.view).toBe('photos');
  });

  it('suggests the welcome screen before the first session', () => {
    const got = suggestScreenView(agenda, at('2026-12-14', '08:00'), [...SCREEN_VIEWS]);
    expect(got?.view).toBe('welcome');
  });

  it('stays quiet about a view that is not switched on', () => {
    const lunch = agenda.sessions.find((s) => s.type === 'meal')!;
    const got = suggestScreenView(
      agenda,
      at(lunch.date, lunch.start),
      SCREEN_VIEWS.filter((v) => v !== 'photos'),
    );
    expect(got?.view).not.toBe('photos');
  });
});
