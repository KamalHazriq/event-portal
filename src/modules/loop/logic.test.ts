import { describe, expect, it } from 'vitest';

import {
  buildLoopItems,
  parseFactLines,
  parseLoop,
  parseRiddleLines,
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
});
