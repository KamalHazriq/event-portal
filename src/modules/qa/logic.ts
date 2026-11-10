/**
 * Module 2: live Q&A per session, the backup for Slido.
 *
 * Pure functions only. See logic.test.ts.
 *
 * Slido runs Q&A and polls for this event. These modules stay switched off
 * for attendees until an admin turns backup mode on, on the day, if Slido
 * is unavailable.
 */
import type { Question, QuestionStatus } from '@/data/types';

export const MAX_QUESTION = 280;
export const MAX_QUESTION_NAME = 60;
/** Brief: at most five questions per phone per session. */
export const MAX_QUESTIONS_PER_DEVICE = 5;
/** How many questions the big screen shows at once. Four two-line questions fill 1080p. */
export const SCREEN_QUESTIONS = 4;

export const QA_KEYS = {
  /** "on" while the portal's own Q&A and polls stand in for Slido. */
  backupMode: 'backup.mode',
  /** "off" lets a session's questions appear without approval first. */
  premoderation: (sessionId: string) => `qa.premoderation.${sessionId}`,
  /** Which session the big screen shows questions for. */
  screenSession: 'qa.screenSession',
} as const;

export function isBackupOn(stored: string | null): boolean {
  return stored === 'on';
}

/** Questions wait for approval unless an admin switched that off for the session. */
export function premoderationOn(stored: string | null): boolean {
  return stored !== 'off';
}

export type QuestionProblem = 'empty' | 'too-long' | 'too-many' | 'closed';

export function validateQuestion(input: {
  text: string;
  alreadyAsked: number;
}): { ok: true } | { ok: false; problem: QuestionProblem } {
  const length = input.text.trim().length;
  if (length === 0) return { ok: false, problem: 'empty' };
  if (length > MAX_QUESTION) return { ok: false, problem: 'too-long' };
  if (input.alreadyAsked >= MAX_QUESTIONS_PER_DEVICE) return { ok: false, problem: 'too-many' };
  return { ok: true };
}

export function questionProblemMessage(problem: QuestionProblem): string {
  switch (problem) {
    case 'empty':
      return 'Type your question first.';
    case 'too-long':
      return `Please keep it under ${MAX_QUESTION} characters.`;
    case 'too-many':
      return `You have asked ${MAX_QUESTIONS_PER_DEVICE} questions in this session, which is the limit.`;
    case 'closed':
      return 'Questions are not open for this session.';
    default: {
      const unreachable: never = problem;
      return String(unreachable);
    }
  }
}

/** What attendees and the big screen may see. A hidden or waiting question never passes. */
export function isPublic(question: Pick<Question, 'status'>): boolean {
  return question.status === 'approved' || question.status === 'answered';
}

/**
 * The order for phones and the big screen: the pinned question, then most
 * votes, then oldest first so an early question is not buried by a tie.
 */
export function rankQuestions<T extends Pick<Question, 'pinned' | 'votes' | 'id'>>(list: T[]): T[] {
  return [...list].sort(
    (a, b) => Number(b.pinned) - Number(a.pinned) || b.votes - a.votes || (a.id < b.id ? -1 : 1),
  );
}

/** The big screen list: approved only (answered ones leave the screen). */
export function screenQuestions<T extends Pick<Question, 'status' | 'pinned' | 'votes' | 'id'>>(
  list: T[],
  limit = SCREEN_QUESTIONS,
): T[] {
  return rankQuestions(list.filter((q) => q.status === 'approved')).slice(0, limit);
}

export const QUESTION_STATUS_LABEL: Record<QuestionStatus, string> = {
  pending: 'Waiting',
  approved: 'On screen',
  answered: 'Answered',
  hidden: 'Hidden',
};

export function countByStatus(list: Pick<Question, 'status'>[]): Record<QuestionStatus, number> {
  const counts: Record<QuestionStatus, number> = {
    pending: 0,
    approved: 0,
    answered: 0,
    hidden: 0,
  };
  for (const q of list) counts[q.status] += 1;
  return counts;
}
