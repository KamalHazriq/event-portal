/**
 * Module 3: polls, the backup for Slido. Single choice, multiple choice and
 * word cloud. Pure functions only, see logic.test.ts.
 */
import type { Poll, PollKind, PollVote } from '@/data/types';

export const POLL_KINDS: readonly PollKind[] = ['single', 'multiple', 'wordcloud'];
export const MAX_POLL_QUESTION = 200;
export const MAX_OPTION = 80;
export const MIN_OPTIONS = 2;
export const MAX_OPTIONS = 8;
/** Brief: word cloud answers are short text, at most 30 characters. */
export const MAX_WORD = 30;

export const POLL_KIND_LABEL: Record<PollKind, string> = {
  single: 'Single choice',
  multiple: 'Multiple choice',
  wordcloud: 'Word cloud',
};

/* ------------------------------------------------------------ creating */

export type PollInputProblem = 'no-question' | 'question-too-long' | 'bad-kind' | 'options';

/** Checks a new poll. Options come one per line from the admin form. */
export function validatePollInput(input: {
  question: string;
  kind: string;
  optionLines: string;
}):
  | { ok: true; value: { question: string; kind: PollKind; options: string[] } }
  | { ok: false; problem: PollInputProblem } {
  const question = input.question.trim();
  if (question.length === 0) return { ok: false, problem: 'no-question' };
  if (question.length > MAX_POLL_QUESTION) return { ok: false, problem: 'question-too-long' };
  if (!(POLL_KINDS as readonly string[]).includes(input.kind))
    return { ok: false, problem: 'bad-kind' };
  const kind = input.kind as PollKind;

  if (kind === 'wordcloud') return { ok: true, value: { question, kind, options: [] } };

  const seen = new Set<string>();
  const options: string[] = [];
  for (const line of input.optionLines.split('\n')) {
    const option = line.trim().slice(0, MAX_OPTION);
    if (!option || seen.has(option.toLowerCase())) continue;
    seen.add(option.toLowerCase());
    options.push(option);
  }
  if (options.length < MIN_OPTIONS || options.length > MAX_OPTIONS) {
    return { ok: false, problem: 'options' };
  }
  return { ok: true, value: { question, kind, options } };
}

export function pollInputMessage(problem: PollInputProblem): string {
  switch (problem) {
    case 'no-question':
      return 'Type the question.';
    case 'question-too-long':
      return `Keep the question under ${MAX_POLL_QUESTION} characters.`;
    case 'bad-kind':
      return 'Choose a type of poll.';
    case 'options':
      return `Give ${MIN_OPTIONS} to ${MAX_OPTIONS} different choices, one per line.`;
    default: {
      const unreachable: never = problem;
      return String(unreachable);
    }
  }
}

/* -------------------------------------------------------------- voting */

export type VoteProblem =
  'closed' | 'nothing-chosen' | 'not-an-option' | 'word-too-long' | 'already';

/** Tidies a word cloud answer so "Ready", " ready " and "READY" count together. */
export function normaliseWord(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * Checks one phone's answer against the poll and returns it in stored form:
 * option numbers as text, or the tidied word.
 */
export function validateVote(
  poll: Pick<Poll, 'kind' | 'options' | 'status'>,
  raw: { choices: string[]; word: string },
): { ok: true; choices: string[] } | { ok: false; problem: VoteProblem } {
  if (poll.status !== 'open') return { ok: false, problem: 'closed' };

  if (poll.kind === 'wordcloud') {
    const word = normaliseWord(raw.word);
    if (word.length === 0) return { ok: false, problem: 'nothing-chosen' };
    if (word.length > MAX_WORD) return { ok: false, problem: 'word-too-long' };
    return { ok: true, choices: [word] };
  }

  const picked = [...new Set(raw.choices)];
  if (picked.length === 0) return { ok: false, problem: 'nothing-chosen' };
  for (const choice of picked) {
    if (!/^\d+$/.test(choice) || Number(choice) >= poll.options.length) {
      return { ok: false, problem: 'not-an-option' };
    }
  }
  // A hand-made request must not sneak two answers into a single choice poll.
  if (poll.kind === 'single' && picked.length !== 1) return { ok: false, problem: 'not-an-option' };
  return { ok: true, choices: picked.sort((a, b) => Number(a) - Number(b)) };
}

export function voteProblemMessage(problem: VoteProblem): string {
  switch (problem) {
    case 'closed':
      return 'This poll is closed.';
    case 'nothing-chosen':
      return 'Choose an answer first.';
    case 'not-an-option':
      return 'That is not one of the choices.';
    case 'word-too-long':
      return `Keep it under ${MAX_WORD} characters.`;
    case 'already':
      return 'Your answer is already in. One per phone.';
    default: {
      const unreachable: never = problem;
      return String(unreachable);
    }
  }
}

/* ------------------------------------------------------------- results */

export type PollResults = {
  /** How many phones answered. */
  voters: number;
  /** One row per choice, or per word, with its count. */
  rows: { label: string; votes: number; percent: number }[];
};

/**
 * Adds up the votes. For choices, every option gets a row (even with no
 * votes) in the order it was written. For a word cloud, the words by count.
 * Percent is of the phones that answered, so a multiple choice poll can add
 * up to more than 100.
 */
export function tallyPoll(
  poll: Pick<Poll, 'kind' | 'options'>,
  votes: Pick<PollVote, 'choices'>[],
): PollResults {
  const voters = votes.length;
  const percent = (n: number) => (voters === 0 ? 0 : Math.round((n / voters) * 100));

  if (poll.kind === 'wordcloud') {
    const counts = new Map<string, number>();
    for (const vote of votes) {
      const word = vote.choices[0];
      if (word) counts.set(word, (counts.get(word) ?? 0) + 1);
    }
    const rows = [...counts.entries()]
      .map(([label, n]) => ({ label, votes: n, percent: percent(n) }))
      .sort((a, b) => b.votes - a.votes || a.label.localeCompare(b.label));
    return { voters, rows };
  }

  const counts = poll.options.map(() => 0);
  for (const vote of votes) {
    for (const choice of new Set(vote.choices)) {
      const index = Number(choice);
      if (Number.isInteger(index) && index >= 0 && index < counts.length) {
        counts[index] = (counts[index] ?? 0) + 1;
      }
    }
  }
  return {
    voters,
    rows: poll.options.map((label, i) => ({
      label,
      votes: counts[i] ?? 0,
      percent: percent(counts[i] ?? 0),
    })),
  };
}

/** A font scale from 1 (rarest) to 3 (most common) for a word cloud. */
export function wordScale(votes: number, most: number): number {
  if (most <= 1) return votes > 0 ? 2 : 1;
  return 1 + (2 * (votes - 1)) / (most - 1);
}
