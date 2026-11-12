/**
 * Basic rate limiting for write endpoints (brief section 7).
 *
 * In memory, so it holds for one running server. That is the right size for
 * this event, which runs on one instance behind one URL. If the portal ever
 * runs on several instances, this moves to the data adapter, which is why
 * nothing outside this file knows how it is stored.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/** Stops the map growing without bound over a three day event. */
function sweep(now: number): void {
  if (buckets.size < 500) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export type RateLimitResult = {
  allowed: boolean;
  /** How many more are allowed in this window. */
  remaining: number;
  /** Seconds until the window resets, for a Retry-After header. */
  retryAfter: number;
};

/**
 * Counts one attempt against a key and says whether to allow it.
 *
 * The key should identify the caller, for example "pin:<ip>" or
 * "checkin:<operator>". It is never a person's name.
 */
export function rateLimit(
  key: string,
  options: { limit: number; windowMs: number },
  now = Date.now(),
): RateLimitResult {
  sweep(now);

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + options.windowMs });
    return { allowed: true, remaining: options.limit - 1, retryAfter: 0 };
  }

  bucket.count += 1;
  const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));

  if (bucket.count > options.limit) {
    return { allowed: false, remaining: 0, retryAfter };
  }

  return { allowed: true, remaining: options.limit - bucket.count, retryAfter };
}

/**
 * Says whether a key is already blocked, without counting an attempt.
 *
 * Used where only failures should count. The admin PIN works that way: two or
 * three people at one event share a hotel's single public address, so
 * counting their successful sign ins would let them lock each other out.
 */
export function isRateLimited(
  key: string,
  options: { limit: number; windowMs: number },
  now = Date.now(),
): RateLimitResult {
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    return { allowed: true, remaining: options.limit, retryAfter: 0 };
  }
  const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
  // Once "limit" attempts are on record the allowance is spent, so the next
  // one is refused. This matches rateLimit, where the call after the limit
  // is the one that fails.
  return {
    allowed: bucket.count < options.limit,
    remaining: Math.max(0, options.limit - bucket.count),
    retryAfter,
  };
}

/** Only for tests, so one test does not inherit another test's counters. */
export function resetRateLimits(): void {
  buckets.clear();
}

/**
 * Sensible limits per endpoint.
 *
 * The check in limit is deliberately generous: a busy desk scans fast, and
 * blocking a real queue would be worse than the thing being prevented.
 */
export const LIMITS = {
  /** Guessing the admin PIN. */
  adminPin: { limit: 10, windowMs: 10 * 60 * 1000 },
  /** Recording arrivals from one desk. */
  checkIn: { limit: 240, windowMs: 60 * 1000 },
  /** Feedback submissions from one device. Generous: a person fills in
   * several session forms over three days, and being blocked from saying
   * what they thought would be worse than the thing being prevented. */
  feedback: { limit: 30, windowMs: 10 * 60 * 1000 },
  /** Searching the attendee list by name. */
  search: { limit: 120, windowMs: 60 * 1000 },
  /** Uploading a spreadsheet, such as the Slido export. Heavy work, rarely needed. */
  upload: { limit: 10, windowMs: 10 * 60 * 1000 },
  /** Asking questions from one phone. The real limit is five per session. */
  qaAsk: { limit: 20, windowMs: 10 * 60 * 1000 },
  /** Upvoting from one phone. */
  qaVote: { limit: 120, windowMs: 10 * 60 * 1000 },
  /** Answering polls from one phone. One answer per poll is the real limit. */
  pollVote: { limit: 60, windowMs: 10 * 60 * 1000 },
  /** Signing in for points from one phone. Stops someone trying staff numbers. */
  join: { limit: 10, windowMs: 10 * 60 * 1000 },
  /** Reaction taps from one phone. Lets real enthusiasm through, stops a script. */
  react: { limit: 90, windowMs: 60 * 1000 },
  /** Comments from one phone. The real limit is five per talk. */
  comment: { limit: 20, windowMs: 10 * 60 * 1000 },
  /** Likes from one phone. */
  commentLike: { limit: 120, windowMs: 10 * 60 * 1000 },
  /** Photo uploads from one phone. Ten is the allowance; this stops a loop. */
  photoUpload: { limit: 20, windowMs: 10 * 60 * 1000 },
  /** Pressing Draw. Generous, but stops a stuck button filling the winners list. */
  luckyDraw: { limit: 20, windowMs: 60 * 1000 },
  /** Building the report. Reads every table, so not on a tight loop. */
  report: { limit: 30, windowMs: 10 * 60 * 1000 },
} as const;
