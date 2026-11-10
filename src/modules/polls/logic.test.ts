import { describe, expect, it } from 'vitest';

import { normaliseWord, tallyPoll, validatePollInput, validateVote, wordScale } from './logic';

import type { Poll } from '@/data/types';

type TestPoll = Pick<Poll, 'kind' | 'options' | 'status'>;
const single: TestPoll = { kind: 'single', options: ['A', 'B', 'C'], status: 'open' };
const multiple: TestPoll = { kind: 'multiple', options: ['A', 'B', 'C'], status: 'open' };
const cloud: TestPoll = { kind: 'wordcloud', options: [], status: 'open' };

describe('creating a poll', () => {
  it('takes options one per line, dropping blanks and repeats', () => {
    const result = validatePollInput({
      question: ' Which topic? ',
      kind: 'single',
      optionLines: 'Hiring\n\n hiring \nMentoring\nSafety',
    });
    expect(result).toEqual({
      ok: true,
      value: {
        question: 'Which topic?',
        kind: 'single',
        options: ['Hiring', 'Mentoring', 'Safety'],
      },
    });
  });

  it('needs a question, a real type and at least two choices', () => {
    expect(validatePollInput({ question: '', kind: 'single', optionLines: 'a\nb' })).toMatchObject({
      problem: 'no-question',
    });
    expect(validatePollInput({ question: 'Q', kind: 'essay', optionLines: 'a\nb' })).toMatchObject({
      problem: 'bad-kind',
    });
    expect(
      validatePollInput({ question: 'Q', kind: 'multiple', optionLines: 'only one' }),
    ).toMatchObject({
      problem: 'options',
    });
  });

  it('a word cloud needs no choices', () => {
    expect(
      validatePollInput({ question: 'One word?', kind: 'wordcloud', optionLines: '' }),
    ).toMatchObject({
      ok: true,
    });
  });
});

describe('voting', () => {
  it('takes one answer on a single choice poll, and refuses two', () => {
    expect(validateVote(single, { choices: ['1'], word: '' })).toEqual({
      ok: true,
      choices: ['1'],
    });
    expect(validateVote(single, { choices: ['0', '2'], word: '' })).toMatchObject({ ok: false });
  });

  it('takes several on a multiple choice poll, without repeats', () => {
    expect(validateVote(multiple, { choices: ['2', '0', '2'], word: '' })).toEqual({
      ok: true,
      choices: ['0', '2'],
    });
  });

  it('refuses a choice that does not exist', () => {
    for (const bad of ['3', '-1', 'x', '1.5']) {
      expect(validateVote(multiple, { choices: [bad], word: '' })).toMatchObject({
        problem: 'not-an-option',
      });
    }
  });

  it('refuses nothing, and a closed poll', () => {
    expect(validateVote(single, { choices: [], word: '' })).toMatchObject({
      problem: 'nothing-chosen',
    });
    expect(
      validateVote({ ...single, status: 'closed' }, { choices: ['0'], word: '' }),
    ).toMatchObject({
      problem: 'closed',
    });
  });

  it('tidies words so the same word counts together, and caps the length', () => {
    expect(normaliseWord('  REady  now ')).toBe('ready now');
    expect(validateVote(cloud, { choices: [], word: ' Hopeful ' })).toEqual({
      ok: true,
      choices: ['hopeful'],
    });
    expect(validateVote(cloud, { choices: [], word: 'x'.repeat(31) })).toMatchObject({
      problem: 'word-too-long',
    });
  });
});

describe('adding up', () => {
  it('gives every option a row, in order, with percent of voters', () => {
    const votes = [{ choices: ['0'] }, { choices: ['0'] }, { choices: ['2'] }, { choices: ['0'] }];
    expect(tallyPoll(single, votes)).toEqual({
      voters: 4,
      rows: [
        { label: 'A', votes: 3, percent: 75 },
        { label: 'B', votes: 0, percent: 0 },
        { label: 'C', votes: 1, percent: 25 },
      ],
    });
  });

  it('counts each choice of a multiple choice answer once', () => {
    const result = tallyPoll(multiple, [{ choices: ['0', '1'] }, { choices: ['1', '1'] }]);
    expect(result.rows.map((r) => r.votes)).toEqual([1, 2, 0]);
    expect(result.voters).toBe(2);
  });

  it('is exact for 80 voters', () => {
    const votes = Array.from({ length: 80 }, (_, i) => ({ choices: [String(i % 3)] }));
    const result = tallyPoll(single, votes);
    expect(result.rows.map((r) => r.votes)).toEqual([27, 27, 26]);
    expect(result.rows.reduce((s, r) => s + r.votes, 0)).toBe(80);
  });

  it('orders a word cloud by count', () => {
    const result = tallyPoll(cloud, [
      { choices: ['ready'] },
      { choices: ['bold'] },
      { choices: ['ready'] },
    ]);
    expect(result.rows).toEqual([
      { label: 'ready', votes: 2, percent: 67 },
      { label: 'bold', votes: 1, percent: 33 },
    ]);
  });

  it('ignores a stored choice that no longer exists', () => {
    expect(tallyPoll(single, [{ choices: ['9'] }]).rows.map((r) => r.votes)).toEqual([0, 0, 0]);
  });

  it('scales word sizes between 1 and 3', () => {
    expect([wordScale(1, 5), wordScale(5, 5), wordScale(3, 5), wordScale(1, 1)]).toEqual([
      1, 3, 2, 2,
    ]);
  });
});
