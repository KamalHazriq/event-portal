import { describe, expect, it } from 'vitest';

import { loadFileConfig } from './config';
import {
  applyOverlay,
  mergeConfig,
  parseOverlay,
  serialiseOverlay,
  type ConfigOverlay,
} from './config-overlay';

const base = loadFileConfig();
const firstDay = base.days[0]!;
const firstSession = firstDay.sessions[0]!;

const merge = (overlay: ConfigOverlay) => mergeConfig(base, JSON.stringify(overlay));

describe('saved edits over the event file', () => {
  it('changes nothing when there are no edits', () => {
    expect(mergeConfig(base, null)).toEqual({ config: base, problems: [] });
    expect(merge({}).config).toEqual(base);
  });

  it('edits the event details, the footer and the Slido link', () => {
    const { config, problems } = merge({
      event: { name: 'Power Summit 2027', venue: 'The Grand Hall', helpText: '' },
      footerText: '© 2026 Someone',
      slido: { eventUrl: 'https://app.sli.do/event/abc', eventCode: '#123' },
    });
    expect(problems).toEqual([]);
    expect(config.event.name).toBe('Power Summit 2027');
    expect(config.event.venue).toBe('The Grand Hall');
    expect(config.event.helpText).toBe('');
    expect(config.event.timezone).toBe(base.event.timezone); // the rest is kept
    expect(config.branding.footerText).toBe('© 2026 Someone');
    expect(config.integrations.slido?.eventUrl).toBe('https://app.sli.do/event/abc');
    expect(config.integrations.slido?.eventCode).toBe('#123');
  });

  it('changes a session by id, and can hide it', () => {
    const { config, problems } = merge({
      sessions: {
        [firstSession.id]: {
          title: 'A new title',
          room: 'Room 9',
          start: '08:00',
          end: '08:30',
          hidden: true,
        },
      },
    });
    expect(problems).toEqual([]);
    const changed = config.days[0]!.sessions.find((s) => s.id === firstSession.id)!;
    expect(changed).toMatchObject({
      title: 'A new title',
      room: 'Room 9',
      start: '08:00',
      hidden: true,
    });
    expect(config.days[0]!.sessions).toHaveLength(firstDay.sessions.length);
  });

  it('adds a session to the right day', () => {
    const { config, problems } = merge({
      addedSessions: [
        {
          dayId: firstDay.id,
          session: {
            id: 'x-bus',
            title: 'Bus to the dinner',
            start: '18:30',
            end: '19:00',
            description: '',
            objectives: [],
            speakerIds: [],
            room: 'Hotel lobby',
            type: 'logistics',
            qaEnabled: false,
            feedbackEnabled: false,
            plain: false,
            hidden: false,
          },
        },
      ],
    });
    expect(problems).toEqual([]);
    expect(config.days[0]!.sessions.map((s) => s.id)).toContain('x-bus');
    expect(config.days[1]!.sessions.map((s) => s.id)).not.toContain('x-bus');
  });

  it('edits and adds speakers', () => {
    const speaker = base.speakers[0]!;
    const { config, problems } = merge({
      speakers: { [speaker.id]: { name: 'Real Name', title: 'Head of Something' } },
      addedSpeakers: [{ id: 'x-new', name: 'New Person', title: '', organisation: '', bio: '' }],
    });
    expect(problems).toEqual([]);
    expect(config.speakers.find((s) => s.id === speaker.id)).toMatchObject({
      name: 'Real Name',
      title: 'Head of Something',
    });
    expect(config.speakers.map((s) => s.id)).toContain('x-new');
  });

  it('replaces the info page, the resources and the department list', () => {
    const { config, problems } = merge({
      info: {
        title: 'Know before you go',
        intro: 'Hello',
        sections: [
          { id: 'wifi', heading: 'Wi-Fi', body: '', items: [{ label: 'Name', text: 'Summit' }] },
        ],
      },
      resources: [
        {
          id: 'slides',
          title: 'Slides',
          url: 'https://files.example.org/s.pdf',
          description: '',
          kind: 'file',
          files: [],
        },
      ],
      departments: [{ name: 'Corporate & Engineering Services', short: 'CORES' }],
    });
    expect(problems).toEqual([]);
    expect(config.info?.sections.map((s) => s.id)).toEqual(['wifi']);
    expect(config.resources).toHaveLength(1);
    expect(config.departments).toEqual([
      { name: 'Corporate & Engineering Services', short: 'CORES' },
    ]);
  });

  it('refuses what does not fit, with a plain reason, and keeps the file', () => {
    const backwards = merge({ sessions: { [firstSession.id]: { start: '12:00', end: '11:00' } } });
    expect(backwards.config).toBe(base);
    expect(backwards.problems.join(' ')).toMatch(/ends before it starts/);
    expect(backwards.problems.join(' ')).toContain(firstSession.title);

    const unknownSpeaker = merge({
      sessions: { [firstSession.id]: { speakerIds: ['nobody-here'] } },
    });
    expect(unknownSpeaker.problems.length).toBeGreaterThan(0);

    const clash = merge({
      addedSessions: [
        {
          dayId: firstDay.id,
          session: { ...firstSession, title: 'Copy' }, // the same id as an existing session
        },
      ],
    });
    expect(clash.problems.length).toBeGreaterThan(0);

    const badLink = merge({
      resources: [
        {
          id: 'a',
          title: 'A',
          url: 'javascript:alert(1)',
          description: '',
          kind: 'link',
          files: [],
        },
      ],
    });
    expect(badLink.problems.length).toBeGreaterThan(0);
    expect(badLink.config).toBe(base);
  });

  it('applyOverlay leaves the file config untouched', () => {
    const before = JSON.stringify(base);
    applyOverlay(base, {
      event: { name: 'Changed' },
      sessions: { [firstSession.id]: { title: 'X' } },
    });
    expect(JSON.stringify(base)).toBe(before);
  });
});

describe('storing the edits', () => {
  it('ignores anything that is not an object of known keys', () => {
    expect(parseOverlay(null)).toEqual({});
    expect(parseOverlay('nope')).toEqual({});
    expect(parseOverlay('[1,2]')).toEqual({});
    expect(parseOverlay('{"event":{"name":"X"},"evil":{"a":1}}')).toEqual({ event: { name: 'X' } });
  });

  it('stores nothing when there are no edits, but keeps an empty list as a choice', () => {
    expect(serialiseOverlay({})).toBeNull();
    expect(serialiseOverlay({ event: {}, sessions: {} })).toBeNull();
    expect(serialiseOverlay({ resources: [] })).toBe('{"resources":[]}');
  });
});
