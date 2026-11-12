import { describe, expect, it } from 'vitest';

import {
  isReactionKind,
  MAX_COMMENT,
  MAX_COMMENTS_PER_DEVICE,
  publicComments,
  reactionEmoji,
  reactionsOpen,
  validateComment,
} from './logic';

describe('reactions', () => {
  const talk = { date: '2026-12-14', startMinutes: 600, endMinutes: 660 };

  it('are open during the talk and for ten minutes after, on its day only', () => {
    expect(reactionsOpen(talk, { date: '2026-12-14', minutes: 599 })).toBe(false);
    expect(reactionsOpen(talk, { date: '2026-12-14', minutes: 600 })).toBe(true);
    expect(reactionsOpen(talk, { date: '2026-12-14', minutes: 669 })).toBe(true);
    expect(reactionsOpen(talk, { date: '2026-12-14', minutes: 670 })).toBe(false);
    expect(reactionsOpen(talk, { date: '2026-12-15', minutes: 620 })).toBe(false);
  });

  it('knows its four kinds and nothing else', () => {
    expect(isReactionKind('clap')).toBe(true);
    expect(isReactionKind('boo')).toBe(false);
    expect(reactionEmoji('fire')).toBe('🔥');
  });
});

describe('comments', () => {
  it('refuses empty, too long, and too many', () => {
    expect(validateComment({ text: '  ', alreadyPosted: 0 })).toEqual({
      ok: false,
      problem: 'empty',
    });
    expect(validateComment({ text: 'x'.repeat(MAX_COMMENT + 1), alreadyPosted: 0 })).toEqual({
      ok: false,
      problem: 'too-long',
    });
    expect(validateComment({ text: 'Great talk', alreadyPosted: MAX_COMMENTS_PER_DEVICE })).toEqual(
      { ok: false, problem: 'too-many' },
    );
    expect(validateComment({ text: 'Great talk', alreadyPosted: 0 })).toEqual({ ok: true });
  });

  it('shows approved only, most liked first, then oldest', () => {
    const list = [
      { id: 'a', status: 'approved' as const, likes: 1, createdAt: '2026-12-14T02:00:00Z' },
      { id: 'b', status: 'pending' as const, likes: 9, createdAt: '2026-12-14T01:00:00Z' },
      { id: 'c', status: 'approved' as const, likes: 3, createdAt: '2026-12-14T03:00:00Z' },
      { id: 'd', status: 'approved' as const, likes: 1, createdAt: '2026-12-14T01:30:00Z' },
      { id: 'e', status: 'hidden' as const, likes: 5, createdAt: '2026-12-14T01:00:00Z' },
    ];
    expect(publicComments(list).map((c) => c.id)).toEqual(['c', 'd', 'a']);
  });
});
