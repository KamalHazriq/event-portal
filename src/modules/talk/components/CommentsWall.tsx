import Link from 'next/link';

import { LikeButton } from './LikeButton';

import type { Comment } from '@/data/types';

import { COMMENT_MESSAGES, MAX_COMMENT, publicComments } from '../logic';
import { localClock } from '@/modules/reports/logic';

/**
 * The comments and take aways on a talk. Plain forms, so it works with no
 * JavaScript; each post comes back to #comments with a short state code.
 */
export function CommentsWall({
  sessionId,
  comments,
  likedIds,
  state,
  nowParam,
  deviceId = null,
  signedInAs = null,
  timezone,
}: {
  sessionId: string;
  comments: Comment[];
  likedIds: string[];
  state: string | null;
  nowParam: string | null;
  /** This phone: its own comments show at once, marked as waiting. */
  deviceId?: string | null;
  /** The name comments are posted under. Null: not signed in yet. */
  signedInAs?: string | null;
  /** The event's time zone, for the time under each comment. */
  timezone?: string;
}) {
  const mine = deviceId
    ? comments.filter((c) => c.deviceId === deviceId && c.status === 'pending')
    : [];
  const shown = [...mine, ...publicComments(comments)];
  const liked = new Set(likedIds);
  const message = state ? COMMENT_MESSAGES[state] : undefined;

  return (
    <section
      id="comments"
      aria-labelledby="comments-heading"
      className="scroll-mt-20 rounded-xl border border-line bg-surface p-4"
    >
      <h2 id="comments-heading" className="text-base font-bold text-ink">
        Comments and take aways
      </h2>
      <p className="text-sm text-ink-soft">
        What stuck with you? The secretariat checks each one before it shows.
      </p>

      {message ? (
        <p
          className={`mt-3 rounded-lg border p-3 text-sm font-semibold text-ink ${
            message.good ? 'border-success bg-success/10' : 'border-warning bg-warning/10'
          }`}
        >
          {message.text}
        </p>
      ) : null}

      {shown.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {shown.map((c) => (
            <li key={c.id} className="rounded-lg border border-line bg-background p-3">
              {c.status === 'pending' ? (
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-warning">
                  Yours, waiting for approval
                </p>
              ) : null}
              <p className="text-ink">{c.text}</p>
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="text-sm text-ink-soft">
                  {c.name}
                  {timezone && c.createdAt ? (
                    <time dateTime={c.createdAt} className="ml-2 text-xs">
                      {localClock(c.createdAt, timezone)}
                    </time>
                  ) : null}
                </span>
                <LikeButton
                  sessionId={sessionId}
                  commentId={c.id}
                  likes={c.likes}
                  liked={liked.has(c.id)}
                  nowParam={nowParam}
                />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-ink-soft">No comments yet. Be the first.</p>
      )}

      {signedInAs ? null : (
        <p className="mt-4 text-sm text-ink">
          Comments carry your name.{' '}
          <Link
            href={`/welcome?next=${encodeURIComponent(`/session/${sessionId}#comments`)}`}
            className="font-semibold text-primary"
          >
            Choose your name
          </Link>{' '}
          to post one.
        </p>
      )}
      <form
        action="/api/comments"
        method="post"
        className={signedInAs ? 'mt-4 space-y-2' : 'hidden'}
      >
        <input type="hidden" name="sessionId" value={sessionId} />
        {nowParam ? <input type="hidden" name="now" value={nowParam} /> : null}
        <label htmlFor="comment-text" className="block text-sm font-semibold text-ink">
          Your comment
        </label>
        <textarea
          id="comment-text"
          name="text"
          required
          maxLength={MAX_COMMENT}
          rows={3}
          aria-describedby="comment-hint"
          className="block w-full rounded-lg border border-line bg-background p-3 text-ink focus:border-primary"
        />
        <p id="comment-hint" className="text-xs text-ink-soft">
          Up to {MAX_COMMENT} characters.
        </p>
        <button
          type="submit"
          className="btn-primary min-h-11 rounded-lg bg-primary px-5 font-bold text-on-primary"
        >
          Post comment
        </button>
      </form>
    </section>
  );
}
