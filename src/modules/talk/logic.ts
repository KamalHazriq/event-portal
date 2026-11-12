/**
 * Taking part during talks: reaction buttons and a comments wall.
 *
 * Reactions are open while a talk is on (and for a short while after, for
 * the applause). They float up on the projector over whatever it shows.
 * Comments are open any time and wait for the secretariat's approval
 * before anyone sees them; the room can then like them.
 *
 * Pure functions only. See logic.test.ts.
 */
import type { Comment, ReactionKind } from '@/data/types';

export const REACTIONS: { kind: ReactionKind; emoji: string; label: string }[] = [
  { kind: 'clap', emoji: '👏', label: 'Applause' },
  { kind: 'fire', emoji: '🔥', label: 'On fire' },
  { kind: 'idea', emoji: '💡', label: 'Great idea' },
  { kind: 'love', emoji: '❤️', label: 'Love it' },
];

export function isReactionKind(value: unknown): value is ReactionKind {
  return typeof value === 'string' && REACTIONS.some((r) => r.kind === value);
}

export function reactionEmoji(kind: ReactionKind): string {
  return REACTIONS.find((r) => r.kind === kind)?.emoji ?? '👏';
}

/** Minutes after a talk ends that reactions still count, for the applause. */
export const REACTION_GRACE_MINUTES = 10;

/** Open from the start of the talk until a little after it ends, on its day. */
export function reactionsOpen(
  session: { date: string; startMinutes: number; endMinutes: number },
  now: { date: string; minutes: number },
): boolean {
  return (
    now.date === session.date &&
    now.minutes >= session.startMinutes &&
    now.minutes < session.endMinutes + REACTION_GRACE_MINUTES
  );
}

/** How far back the projector looks for reactions to float up. */
export const SCREEN_REACTION_WINDOW_MS = 12_000;

export const MAX_COMMENT = 280;
export const MAX_COMMENT_NAME = 60;
export const MAX_COMMENTS_PER_DEVICE = 5;
/** How many comments the projector shows at once. */
export const SCREEN_COMMENTS = 5;

export const COMMENT_KEYS = {
  /** Which talk the projector shows comments for. */
  screenSession: 'comments.screenSession',
  /** "off" stops reactions floating up on the projector. */
  screenReactions: 'reactions.onScreen',
} as const;

export type CommentProblem = 'empty' | 'too-long' | 'too-many';

export function validateComment(input: {
  text: string;
  alreadyPosted: number;
}): { ok: true } | { ok: false; problem: CommentProblem } {
  const length = input.text.trim().length;
  if (length === 0) return { ok: false, problem: 'empty' };
  if (length > MAX_COMMENT) return { ok: false, problem: 'too-long' };
  if (input.alreadyPosted >= MAX_COMMENTS_PER_DEVICE) return { ok: false, problem: 'too-many' };
  return { ok: true };
}

export const COMMENT_MESSAGES: Record<string, { text: string; good: boolean }> = {
  posted: {
    text: 'Thanks. Your comment shows here once the secretariat has approved it.',
    good: true,
  },
  liked: { text: 'Liked.', good: true },
  already: { text: 'You already liked that one.', good: true },
  empty: { text: 'Type your comment first.', good: false },
  'too-long': { text: `Please keep it under ${MAX_COMMENT} characters.`, good: false },
  'too-many': {
    text: `You have posted ${MAX_COMMENTS_PER_DEVICE} comments on this talk, which is the limit.`,
    good: false,
  },
  'slow-down': { text: 'Slow down a little, then try again.', good: false },
  gone: { text: 'That comment is no longer shown.', good: false },
  closed: { text: 'Comments are not open.', good: false },
};

/** Most liked first, then oldest first so an early comment is not buried by a tie. */
export function rankComments<T extends Pick<Comment, 'likes' | 'createdAt' | 'id'>>(
  list: T[],
): T[] {
  return [...list].sort(
    (a, b) => b.likes - a.likes || a.createdAt.localeCompare(b.createdAt) || (a.id < b.id ? -1 : 1),
  );
}

/** What the room may see: approved only. */
export function publicComments<T extends Pick<Comment, 'status' | 'likes' | 'createdAt' | 'id'>>(
  list: T[],
): T[] {
  return rankComments(list.filter((c) => c.status === 'approved'));
}

export const COMMENT_STATUS_LABEL: Record<Comment['status'], string> = {
  pending: 'Waiting',
  approved: 'Shown',
  hidden: 'Hidden',
};
