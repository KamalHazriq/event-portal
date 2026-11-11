/**
 * Checks on the real config/event.json, whatever the agenda says this week.
 *
 * The other config tests use a frozen copy (config/event.test.json), so these
 * are the ones that catch a mistake made while editing the real agenda.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { EventConfigSchema } from './event-schema';

const raw = readFileSync(join(process.cwd(), 'config', 'event.json'), 'utf8');
const config = EventConfigSchema.parse(JSON.parse(raw));
const sessions = config.days.flatMap((day) => day.sessions);

describe('the real event config', () => {
  it('is valid', () => {
    expect(config.days.length).toBeGreaterThan(0);
    expect(config.event.timezone).toBe('Asia/Kuala_Lumpur');
  });

  it('has its days in date order, inside the event dates', () => {
    const dates = config.days.map((day) => day.date);
    expect([...dates].sort()).toEqual(dates);
    for (const date of dates) {
      expect(date >= config.event.startDate && date <= config.event.endDate).toBe(true);
    }
  });

  it('uses every session id once, across all days', () => {
    const ids = sessions.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('points every speakerId at a real speaker', () => {
    const known = new Set(config.speakers.map((s) => s.id));
    for (const session of sessions) {
      for (const id of session.speakerIds)
        expect(known.has(id), `${session.id} > ${id}`).toBe(true);
    }
  });

  it('has each day in time order', () => {
    for (const day of config.days) {
      const starts = day.sessions.map((s) => s.start);
      expect([...starts].sort(), day.id).toEqual(starts);
    }
  });

  it('writes no em or en dashes in anything a person will read', () => {
    expect(raw).not.toMatch(/[—–]/);
  });

  it('has a countdown inside the event, if it has one', () => {
    if (!config.surprise?.targetAt) return;
    const date = config.surprise.targetAt.slice(0, 10);
    expect(date >= config.event.startDate && date <= config.event.endDate).toBe(true);
  });
});
