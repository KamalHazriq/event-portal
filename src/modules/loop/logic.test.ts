import { describe, expect, it } from 'vitest';

import {
  buildLoopItems,
  liveFactTexts,
  missingFromPack,
  RIDDLE_PACKS,
  parseFactLines,
  parseLoop,
  parseRiddleLines,
  riddlesFromRows,
  safePhoto,
  DEFAULT_LOOP,
} from './logic';

describe('the screensaver loop', () => {
  it('reads riddles as "question | answer" and drops lines with no answer', () => {
    expect(parseRiddleLines('Apa dia? | Jawapan\nno answer here\n | x\nQ2 | A2')).toEqual([
      { q: 'Apa dia?', a: 'Jawapan' },
      { q: 'Q2', a: 'A2' },
    ]);
  });

  it('keeps one fact per line', () => {
    expect(parseFactLines('One\n\n  Two  \n')).toEqual(['One', 'Two']);
  });

  it('mixes the kinds in turn', () => {
    const items = buildLoopItems({
      riddles: [
        { q: 'q1', a: 'a1' },
        { q: 'q2', a: 'a2' },
      ],
      facts: ['f1'],
      leads: [{ id: 'l1', name: 'Aina', role: 'Head' }],
      liveFacts: false,
    });
    expect(items.map((i) => i.kind)).toEqual(['riddle', 'fact', 'lead', 'riddle']);
  });

  it('starts from the defaults and survives a damaged value', () => {
    expect(parseLoop(null)).toEqual(DEFAULT_LOOP);
    expect(parseLoop('{nope')).toEqual(DEFAULT_LOOP);
  });

  it('only accepts a small JPEG data address as a photo', () => {
    expect(safePhoto('data:image/jpeg;base64,AAAA')).toBe('data:image/jpeg;base64,AAAA');
    expect(safePhoto('data:image/svg+xml;base64,AAAA')).toBeNull();
    expect(safePhoto('https://example.com/a.jpg')).toBeNull();
  });

  it('adds only the riddles of a pack that are missing', () => {
    const pack = RIDDLE_PACKS[0]!;
    expect(missingFromPack([], pack)).toHaveLength(pack.riddles.length);
    expect(missingFromPack(pack.riddles, pack)).toEqual([]);
  });

  it('writes live facts from the numbers and leaves out zeros', () => {
    const facts = liveFactTexts({
      people: 1,
      days: 3,
      sessions: 24,
      venue: 'Grand Ballroom',
      checkedIn: 0,
      photos: 2,
      comments: 0,
    });
    expect(facts).toEqual([
      '1 colleague is on the list for this summit, at Grand Ballroom.',
      'The summit has 24 sessions over 3 days.',
      '2 photos have been shared on the photo wall.',
    ]);
  });
});

describe('riddlesFromRows', () => {
  it('keeps rows that have both a question and an answer', () => {
    expect(riddlesFromRows(['Q1', '', 'Q3'], ['A1', 'A2', ''])).toEqual([{ q: 'Q1', a: 'A1' }]);
  });
});
