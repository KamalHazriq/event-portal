/**
 * These tests guard the real config/event.json that ships with the repo.
 *
 * If someone edits the agenda and breaks it, this fails before the portal is
 * ever opened in a browser.
 */
import { describe, expect, it } from 'vitest';

import { clearConfigCache, loadEventConfig, resolveConfigPath, ConfigError } from './config';
import { EventConfigSchema } from './event-schema';

describe('the event config that ships with the repo', () => {
  const config = (() => {
    clearConfigCache();
    return loadEventConfig();
  })();

  it('loads from config/event.json by default', () => {
    expect(resolveConfigPath().replace(/\\/g, '/')).toMatch(/config\/event\.json$/);
  });

  it('describes a three day event in Malaysia', () => {
    expect(config.days).toHaveLength(3);
    expect(config.event.timezone).toBe('Asia/Kuala_Lumpur');
    expect(config.event.startDate).toBe('2026-12-14');
    expect(config.event.endDate).toBe('2026-12-16');
  });

  it('starts on Day 1 in the afternoon and ends by noon on Day 3', () => {
    const [day1, , day3] = config.days;
    const firstStart = day1?.sessions[0]?.start ?? '';
    const lastEnd = day3?.sessions[(day3?.sessions.length ?? 1) - 1]?.end ?? '';

    expect(firstStart >= '12:00').toBe(true);
    expect(lastEnd <= '12:00').toBe(true);
  });

  it('has a dinner and a night activity on Day 1', () => {
    const day1 = config.days[0];
    expect(day1?.sessions.some((session) => session.type === 'meal')).toBe(true);
    expect(
      day1?.sessions.some((session) => session.type === 'activity' && session.start >= '19:00'),
    ).toBe(true);
  });

  it('has parallel breakouts on Day 2', () => {
    const breakouts = config.days[1]?.sessions.filter((s) => s.type === 'breakout') ?? [];
    expect(breakouts.length).toBeGreaterThanOrEqual(2);
    const starts = new Set(breakouts.map((session) => session.start));
    expect(starts.size).toBe(1);
  });

  it('uses the brand colours from the brief', () => {
    expect(config.branding.brand.primary).toBe('#0053A1');
    expect(config.branding.brand.navy).toBe('#042C75');
    expect(config.branding.brand.panel).toBe('#E6EEF8');
  });

  it('ships both a light and a dark theme', () => {
    expect(config.branding.themes.light.primary).toBeTruthy();
    expect(config.branding.themes.dark.primary).toBeTruthy();
    expect(config.branding.themes.light.background).not.toBe(
      config.branding.themes.dark.background,
    );
  });

  it('has Slido switched on with a link, since the event runs on Slido', () => {
    expect(config.integrations.slido?.enabled).toBe(true);
    expect(
      config.integrations.slido?.eventUrl ?? config.integrations.slido?.eventCode,
    ).toBeTruthy();
  });

  it('only switches on the modules that are built', () => {
    expect(config.features.schedule).toBe(true);
    expect(config.features.resources).toBe(true);
    expect(config.features.checkIn).toBe(false);
    expect(config.features.qa).toBe(false);
    expect(config.features.polls).toBe(false);
  });

  it('lists take away resources', () => {
    expect(config.resources.length).toBeGreaterThan(0);
  });

  it('writes no em dashes in anything a person will read', () => {
    const text = JSON.stringify(config);
    expect(text).not.toMatch(/[—–]/);
  });

  it('points every speakerId at a real speaker', () => {
    const known = new Set(config.speakers.map((speaker) => speaker.id));
    for (const day of config.days) {
      for (const session of day.sessions) {
        for (const speakerId of session.speakerIds) {
          expect(known, `${session.id} refers to ${speakerId}`).toContain(speakerId);
        }
      }
    }
  });
});

describe('validation', () => {
  it('fills in the optional fields so pages never see undefined', () => {
    const parsed = EventConfigSchema.parse({
      configVersion: 1,
      event: {
        name: 'Minimal',
        shortName: 'Min',
        startDate: '2027-01-01',
        endDate: '2027-01-01',
        venue: 'TBC',
      },
      branding: {
        brand: { primary: '#0053A1', navy: '#042C75', panel: '#E6EEF8' },
        themes: {
          light: minimalTheme(),
          dark: minimalTheme(),
        },
      },
      days: [
        {
          id: 'day-1',
          date: '2027-01-01',
          label: 'Day 1',
          sessions: [{ id: 's1', start: '09:00', end: '10:00', title: 'Hello', type: 'talk' }],
        },
      ],
    });

    expect(parsed.event.timezone).toBe('Asia/Kuala_Lumpur');
    expect(parsed.features.schedule).toBe(true);
    expect(parsed.features.checkIn).toBe(false);
    expect(parsed.speakers).toEqual([]);
    expect(parsed.resources).toEqual([]);
    expect(parsed.days[0]?.sessions[0]?.objectives).toEqual([]);
    expect(parsed.days[0]?.sessions[0]?.qaEnabled).toBe(false);
  });

  it('refuses a session that ends before it starts', () => {
    const result = EventConfigSchema.safeParse(brokenConfig({ start: '15:00', end: '14:00' }));
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain('end time must be after start time');
  });

  it('refuses a day outside the event dates', () => {
    const base = brokenConfig();
    const day = base.days[0];
    if (day) day.date = '2030-01-01';
    const result = EventConfigSchema.safeParse(base);
    expect(result.success).toBe(false);
  });

  it('refuses a speakerId that does not exist', () => {
    const base = brokenConfig();
    const session = base.days[0]?.sessions[0];
    if (session) session.speakerIds = ['nobody'];
    const result = EventConfigSchema.safeParse(base);
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain('speakerId');
  });

  it('refuses two sessions with the same id', () => {
    const base = brokenConfig();
    const day = base.days[0];
    const first = day?.sessions[0];
    if (day && first) day.sessions.push({ ...first });
    const result = EventConfigSchema.safeParse(base);
    expect(result.success).toBe(false);
  });

  it('refuses a colour that is not a hex value', () => {
    const base = brokenConfig();
    base.branding.brand.primary = 'cornflower blue';
    const result = EventConfigSchema.safeParse(base);
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain('hex colour');
  });

  it('refuses a time zone it does not know', () => {
    const base = brokenConfig();
    base.event.timezone = 'Mars/Olympus';
    const result = EventConfigSchema.safeParse(base);
    expect(result.success).toBe(false);
  });
});

describe('ConfigError', () => {
  it('reads as plain English with one line per problem', () => {
    const error = new ConfigError('config/event.json', ['days: two days share the same id']);
    expect(error.message).toContain('config/event.json is not valid');
    expect(error.message).toContain('two days share the same id');
    expect(error.problems).toHaveLength(1);
  });
});

/* -------------------------------------------------------------- helpers */

function minimalTheme(): Record<string, string> {
  return {
    background: '#FFFFFF',
    surface: '#FFFFFF',
    surfaceMuted: '#EEEEEE',
    border: '#CCCCCC',
    text: '#000000',
    textMuted: '#555555',
    primary: '#0053A1',
    primaryText: '#FFFFFF',
    accent: '#00A3E0',
    accentText: '#042C75',
    live: '#C2410C',
    success: '#1C7C4D',
    warning: '#A16207',
  };
}

/**
 * A loose shape, so a test can reach in and break one field without
 * TypeScript objecting to something that is meant to be invalid.
 */
type LooseConfig = {
  configVersion: number;
  event: Record<string, unknown> & { timezone?: string };
  branding: { brand: Record<string, string>; themes: Record<string, unknown> };
  speakers: Record<string, unknown>[];
  days: {
    id: string;
    date: string;
    label: string;
    sessions: Record<string, unknown>[];
  }[];
};

/** A valid config, so each test can break exactly one thing. */
function brokenConfig(session?: { start: string; end: string }): LooseConfig {
  return {
    configVersion: 1,
    event: {
      name: 'Minimal',
      shortName: 'Min',
      startDate: '2027-01-01',
      endDate: '2027-01-01',
      venue: 'TBC',
    },
    branding: {
      brand: { primary: '#0053A1', navy: '#042C75', panel: '#E6EEF8' },
      themes: { light: minimalTheme(), dark: minimalTheme() },
    },
    speakers: [{ id: 'sp-one', name: 'Speaker One' }],
    days: [
      {
        id: 'day-1',
        date: '2027-01-01',
        label: 'Day 1',
        sessions: [
          {
            id: 's1',
            start: session?.start ?? '09:00',
            end: session?.end ?? '10:00',
            title: 'Hello',
            type: 'talk',
          },
        ],
      },
    ],
  };
}
