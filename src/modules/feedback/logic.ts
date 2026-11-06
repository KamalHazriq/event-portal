/**
 * Module 5 logic: which feedback forms exist, who may be named on them, and
 * what counts as a valid answer.
 *
 * Pure functions only, so the rules can be tested without a database or a
 * browser. See logic.test.ts.
 */
import type { AnonymityMode } from '@/data/types';
import type { EventConfig } from '@/lib/event-schema';
import { multilineText, plainText } from '@/lib/text';

/** The whole event form, as opposed to a single session. */
export const EVENT_FORM_ID = 'event-final';

/** The nicer looking path. The stored id stays EVENT_FORM_ID. */
export const EVENT_FORM_SLUG = 'event';

export const ANONYMITY_MODES = ['anonymous', 'named', 'optional'] as const;

export const DEFAULT_ANONYMITY: AnonymityMode = 'optional';

export const MAX_COMMENT = 600;
export const MAX_NAME = 80;

/* --------------------------------------------------------------- settings */

/**
 * Settings live in the data adapter rather than in config/event.json,
 * because an admin changes them during the event and the config file is
 * version controlled.
 */
export const SETTING_KEYS = {
  anonymityDefault: 'feedback.anonymity.default',
  anonymityFor: (formId: string) => `feedback.anonymity.${formId}`,
  openFor: (formId: string) => `feedback.open.${formId}`,
} as const;

export function isAnonymityMode(value: unknown): value is AnonymityMode {
  return typeof value === 'string' && (ANONYMITY_MODES as readonly string[]).includes(value);
}

/**
 * Which anonymity rule applies: the form's own setting, else the event wide
 * default, else "optional".
 */
export function resolveAnonymity(
  formOverride: string | null,
  eventDefault: string | null,
): AnonymityMode {
  if (isAnonymityMode(formOverride)) return formOverride;
  if (isAnonymityMode(eventDefault)) return eventDefault;
  return DEFAULT_ANONYMITY;
}

/** Forms are open unless an admin has closed them. */
export function isFormOpen(setting: string | null): boolean {
  return setting !== 'closed';
}

export function anonymityLabel(mode: AnonymityMode): string {
  switch (mode) {
    case 'anonymous':
      return 'Anonymous, no names collected';
    case 'named':
      return 'Names required';
    case 'optional':
      return 'Name optional';
    default: {
      const unreachable: never = mode;
      return String(unreachable);
    }
  }
}

/* ------------------------------------------------------------------ forms */

export type FeedbackFormKind = 'session' | 'event';

export type FeedbackForm = {
  /** The id answers are stored against. */
  id: string;
  /** The path segment under /feedback. */
  slug: string;
  kind: FeedbackFormKind;
  title: string;
  /** Shown under the title, for example "Day 2, 9:00 am to 10:00 am". */
  context: string;
};

/** Turns a URL segment back into a stored form id. */
export function formIdFromSlug(slug: string): string {
  return slug === EVENT_FORM_SLUG ? EVENT_FORM_ID : slug;
}

export function slugForFormId(formId: string): string {
  return formId === EVENT_FORM_ID ? EVENT_FORM_SLUG : formId;
}

/**
 * Every form this event has: one per session that asks for feedback, plus
 * the final event form.
 */
export function feedbackForms(config: EventConfig): FeedbackForm[] {
  const forms: FeedbackForm[] = [];

  for (const day of config.days) {
    for (const session of day.sessions) {
      if (!session.feedbackEnabled || session.hidden) continue;
      forms.push({
        id: session.id,
        slug: session.id,
        kind: 'session',
        title: session.title,
        context: `${day.label}, ${session.start} to ${session.end}`,
      });
    }
  }

  forms.push({
    id: EVENT_FORM_ID,
    slug: EVENT_FORM_SLUG,
    kind: 'event',
    title: `About ${config.event.shortName}`,
    context: 'The whole event',
  });

  return forms;
}

export function findFeedbackForm(config: EventConfig, formId: string): FeedbackForm | null {
  return feedbackForms(config).find((form) => form.id === formId) ?? null;
}

/* ------------------------------------------------------------- validation */

export type SubmissionInput = {
  rating: unknown;
  comment: unknown;
  /** Event form only. */
  bestSessionId?: unknown;
  improve?: unknown;
  name: unknown;
};

export type SubmissionProblem =
  'rating-missing' | 'rating-invalid' | 'name-missing' | 'comment-too-long';

export type ValidatedSubmission = {
  rating: number;
  answers: Record<string, string>;
  displayName: string;
};

/** A star rating has to be a whole number from 1 to 5. */
export function parseRating(value: unknown): number | null {
  const text = typeof value === 'string' || typeof value === 'number' ? String(value) : '';
  if (!/^[1-5]$/.test(text.trim())) return null;
  return Number(text.trim());
}

/**
 * Checks one submission.
 *
 * Returns either the cleaned answers or the list of problems, so the page can
 * say exactly what is missing without a round trip per field.
 */
export function validateSubmission(
  form: FeedbackForm,
  mode: AnonymityMode,
  input: SubmissionInput,
  knownSessionIds: Set<string> = new Set(),
): { ok: true; value: ValidatedSubmission } | { ok: false; problems: SubmissionProblem[] } {
  const problems: SubmissionProblem[] = [];

  const rating = parseRating(input.rating);
  if (rating === null) {
    const given = typeof input.rating === 'string' ? input.rating.trim() : '';
    problems.push(given.length === 0 ? 'rating-missing' : 'rating-invalid');
  }

  // Anonymous forms ignore a name even if one is posted.
  const rawName = mode === 'anonymous' ? '' : plainText(input.name, MAX_NAME);
  if (mode === 'named' && rawName.length === 0) problems.push('name-missing');

  const comment = multilineText(input.comment, MAX_COMMENT + 1);
  if (comment.length > MAX_COMMENT) problems.push('comment-too-long');

  const answers: Record<string, string> = {};
  if (comment.length > 0) answers.comment = comment.slice(0, MAX_COMMENT);

  if (form.kind === 'event') {
    const improve = multilineText(input.improve, MAX_COMMENT + 1);
    if (improve.length > MAX_COMMENT) problems.push('comment-too-long');
    if (improve.length > 0) answers.improve = improve.slice(0, MAX_COMMENT);

    // Only a session that exists, so the report cannot point at nothing.
    const best = plainText(input.bestSessionId, 64);
    if (best.length > 0 && knownSessionIds.has(best)) answers.bestSessionId = best;
  }

  if (problems.length > 0) return { ok: false, problems: [...new Set(problems)] };

  return {
    ok: true,
    value: { rating: rating as number, answers, displayName: rawName },
  };
}

export function problemMessage(problem: SubmissionProblem): string {
  switch (problem) {
    case 'rating-missing':
      return 'Please choose a rating from 1 to 5 stars.';
    case 'rating-invalid':
      return 'That rating was not one of the five options.';
    case 'name-missing':
      return 'This form asks for your name.';
    case 'comment-too-long':
      return `Please keep each comment under ${MAX_COMMENT} characters.`;
    default: {
      const unreachable: never = problem;
      return String(unreachable);
    }
  }
}

/* ---------------------------------------------------------------- results */

export type RatingCounts = Record<1 | 2 | 3 | 4 | 5, number>;

/** "4.2 out of 5", or "no ratings yet". */
export function formatAverage(average: number | null): string {
  if (average === null) return 'no ratings yet';
  return `${average.toFixed(1)} out of 5`;
}

/**
 * How wide each bar should be, as a percentage of the most common rating.
 * Scaling to the biggest bar rather than the total keeps a small sample
 * readable.
 */
export function ratingBarWidths(counts: RatingCounts): Record<1 | 2 | 3 | 4 | 5, number> {
  const values = [counts[1], counts[2], counts[3], counts[4], counts[5]];
  const largest = Math.max(...values);
  const scale = (value: number) => (largest === 0 ? 0 : Math.round((value / largest) * 100));
  return {
    1: scale(counts[1]),
    2: scale(counts[2]),
    3: scale(counts[3]),
    4: scale(counts[4]),
    5: scale(counts[5]),
  };
}

/** Counts how often each session was picked as the best one. */
export function tallyBestSessions(
  entries: { answers: Record<string, string> }[],
): { sessionId: string; votes: number }[] {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    const best = entry.answers.bestSessionId;
    if (!best) continue;
    counts.set(best, (counts.get(best) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([sessionId, votes]) => ({ sessionId, votes }))
    .sort((a, b) => b.votes - a.votes || a.sessionId.localeCompare(b.sessionId));
}
