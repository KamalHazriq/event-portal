'use client';

import { useState } from 'react';

/**
 * The 👍 on a comment. It counts at once and tells the server in the
 * background, so the page never reloads or jumps. Without JavaScript it is
 * still a plain form.
 */
export function LikeButton({
  sessionId,
  commentId,
  likes,
  liked,
  nowParam,
}: {
  sessionId: string;
  commentId: string;
  likes: number;
  liked: boolean;
  nowParam: string | null;
}) {
  const [count, setCount] = useState(likes);
  const [done, setDone] = useState(liked);

  return (
    <form
      action="/api/comments/like"
      method="post"
      onSubmit={async (event) => {
        event.preventDefault();
        if (done) return;
        setDone(true);
        setCount((n) => n + 1);
        try {
          const body = new FormData(event.currentTarget);
          const res = await fetch('/api/comments/like', {
            method: 'POST',
            body,
            headers: { Accept: 'application/json' },
          });
          const json = (await res.json()) as { likes?: number };
          if (typeof json.likes === 'number') setCount(json.likes);
        } catch {
          // The tap still counted on this screen; the next refresh will say.
        }
      }}
    >
      <input type="hidden" name="sessionId" value={sessionId} />
      <input type="hidden" name="commentId" value={commentId} />
      {nowParam ? <input type="hidden" name="now" value={nowParam} /> : null}
      <button
        type="submit"
        disabled={done}
        aria-label={`Like, ${count} so far`}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line px-3 text-sm font-semibold text-ink disabled:border-primary disabled:text-primary"
      >
        <span aria-hidden="true">👍</span>
        <span className="tabular-nums">{count}</span>
      </button>
    </form>
  );
}
