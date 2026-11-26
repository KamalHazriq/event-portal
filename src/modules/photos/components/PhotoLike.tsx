'use client';

import { Icon } from '@/components/icons';
import { useState } from 'react';

/** The heart under a photo: counts at once, tells the server in the background. */
export function PhotoLike({
  photoId,
  likes,
  liked,
}: {
  photoId: string;
  likes: number;
  liked: boolean;
}) {
  const [count, setCount] = useState(likes);
  const [done, setDone] = useState(liked);

  return (
    <form
      action="/api/photos/social"
      method="post"
      onSubmit={async (event) => {
        event.preventDefault();
        if (done) return;
        setDone(true);
        setCount((n) => n + 1);
        try {
          const body = new FormData(event.currentTarget);
          const res = await fetch('/api/photos/social', {
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
      <input type="hidden" name="action" value="like" />
      <input type="hidden" name="photoId" value={photoId} />
      <button
        type="submit"
        disabled={done}
        aria-label={`Like this photo, ${count} so far`}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line px-3 text-sm font-semibold text-ink disabled:border-primary disabled:text-primary"
      >
        <Icon name="heart" filled={done} className="size-4" />
        <span className="tabular-nums">{count}</span>
      </button>
    </form>
  );
}
