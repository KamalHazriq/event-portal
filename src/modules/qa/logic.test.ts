import { describe, expect, it } from 'vitest';

import {
  countByStatus,
  isBackupOn,
  isPublic,
  MAX_QUESTION,
  MAX_QUESTIONS_PER_DEVICE,
  premoderationOn,
  rankQuestions,
  screenQuestions,
  validateQuestion,
} from './logic';

import type { QuestionStatus } from '@/data/types';

const q = (id: string, votes: number, status: QuestionStatus = 'approved', pinned = false) => ({
  id,
  votes,
  status,
  pinned,
});

describe('switches', () => {
  it('backup mode is off unless switched on', () => {
    expect([isBackupOn(null), isBackupOn('off'), isBackupOn('on')]).toEqual([false, false, true]);
  });

  it('questions wait for approval unless switched off', () => {
    expect([premoderationOn(null), premoderationOn('on'), premoderationOn('off')]).toEqual([
      true,
      true,
      false,
    ]);
  });
});

describe('asking a question', () => {
  it('accepts a normal question', () => {
    expect(validateQuestion({ text: 'Who owns this?', alreadyAsked: 0 })).toEqual({ ok: true });
  });

  it('refuses empty, too long, and the sixth from one phone', () => {
    expect(validateQuestion({ text: '   ', alreadyAsked: 0 })).toEqual({
      ok: false,
      problem: 'empty',
    });
    expect(validateQuestion({ text: 'x'.repeat(MAX_QUESTION + 1), alreadyAsked: 0 })).toEqual({
      ok: false,
      problem: 'too-long',
    });
    expect(validateQuestion({ text: 'One more', alreadyAsked: MAX_QUESTIONS_PER_DEVICE })).toEqual({
      ok: false,
      problem: 'too-many',
    });
  });
});

describe('what the room sees', () => {
  it('never shows a hidden or waiting question', () => {
    expect(
      ['pending', 'approved', 'answered', 'hidden'].map((status) => isPublic({ status } as never)),
    ).toEqual([false, true, true, false]);
    const list = [
      q('a', 9, 'hidden'),
      q('b', 5, 'pending'),
      q('c', 1, 'approved'),
      q('d', 7, 'answered'),
    ];
    expect(screenQuestions(list).map((x) => x.id)).toEqual(['c']);
  });

  it('puts the pinned question first, then most votes, then oldest', () => {
    const list = [q('1', 3), q('2', 8), q('3', 8), q('4', 1, 'approved', true)];
    expect(rankQuestions(list).map((x) => x.id)).toEqual(['4', '2', '3', '1']);
  });

  it('limits the big screen list', () => {
    const many = Array.from({ length: 9 }, (_, i) => q(String(i), i));
    expect(screenQuestions(many, 3).map((x) => x.id)).toEqual(['8', '7', '6']);
  });

  it('counts by status', () => {
    expect(countByStatus([q('a', 0, 'pending'), q('b', 0), q('c', 0)])).toEqual({
      pending: 1,
      approved: 2,
      answered: 0,
      hidden: 0,
    });
  });
});
