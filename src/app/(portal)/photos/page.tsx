import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';

import { getData } from '@/data';
import { getEventConfig } from '@/lib/config';
import { DEVICE_COOKIE, readDeviceId } from '@/lib/device';
import Link from 'next/link';
import { currentPlayer } from '@/modules/points/server';
import { PhotoLike } from '@/modules/photos/components/PhotoLike';
import { isPhotoSession, PHOTO_SESSION_PREFIX, photoLikes } from '@/modules/photos/social';
import { COMMENT_MESSAGES, MAX_COMMENT } from '@/modules/talk/logic';
import { PhotoUploader } from '@/modules/photos/components/PhotoUploader';
import { moderationOn, PHOTO_KEYS } from '@/modules/photos/logic';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Share a photo' };

/** Attendees share photos for the big screen slideshow. */
export default async function PhotosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const openId = typeof query.open === 'string' ? query.open : null;
  const notice = typeof query.state === 'string' ? COMMENT_MESSAGES[query.state] : undefined;
  const config = getEventConfig();
  if (!config.features.photoWall) notFound();

  const store = await cookies();
  const deviceId = readDeviceId(store.get(DEVICE_COOKIE)?.value);
  const data = getData();
  const [alreadySent, moderation, onTheWall] = await Promise.all([
    deviceId ? data.photos.countByDevice(deviceId) : Promise.resolve(0),
    data.settings.get(PHOTO_KEYS.moderation),
    data.photos.list('approved'),
  ]);
  const moderated = moderationOn(moderation);
  const [likes, me, allComments] = await Promise.all([
    photoLikes(deviceId),
    config.features.comments ? currentPlayer() : Promise.resolve(null),
    config.features.comments ? data.comments.listApproved() : Promise.resolve([]),
  ]);
  const commentsByPhoto = new Map<string, typeof allComments>();
  for (const c of allComments) {
    if (!isPhotoSession(c.sessionId)) continue;
    const id = c.sessionId.slice(PHOTO_SESSION_PREFIX.length);
    commentsByPhoto.set(id, [...(commentsByPhoto.get(id) ?? []), c]);
  }

  return (
    <div className="space-y-5 py-2">
      <div>
        <p className="eyebrow">Photo wall</p>
        <h1 className="mt-2 text-2xl font-bold text-ink sm:text-3xl">Share a photo</h1>
        <p className="mt-3 text-ink-soft">
          Your photos play on the big screen during breaks and dinner
          {moderated ? ', once an organiser has checked them' : ''}. Up to three at a time, each
          with a caption. Tap Save under any photo to keep it in full quality.
        </p>
      </div>

      {notice ? (
        <p
          role="status"
          className={`rounded-lg border p-3 text-sm font-semibold ${
            notice.good ? 'border-success text-success' : 'border-warning text-warning'
          }`}
        >
          {notice.text}
        </p>
      ) : null}

      <PhotoUploader alreadySent={alreadySent} moderated={moderated} />

      <section aria-labelledby="wall" className="space-y-3 pt-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="wall" className="text-lg font-bold text-ink">
            On the wall
          </h2>
          <span className="text-sm tabular-nums text-ink-soft">
            {onTheWall.length} {onTheWall.length === 1 ? 'photo' : 'photos'}
          </span>
        </div>
        {onTheWall.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line p-6 text-center text-ink-soft">
            No photos yet. Be the first to share one.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {onTheWall.map((photo) => {
              const comments = commentsByPhoto.get(photo.id) ?? [];
              return (
                <li
                  key={photo.id}
                  id={`photo-${photo.id}`}
                  className="scroll-mt-20 overflow-hidden rounded-lg border border-line bg-surface"
                >
                  <a
                    href={`/api/photos/${photo.id}`}
                    target="_blank"
                    rel="noopener"
                    className="block"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/photos/${photo.id}?size=thumb`}
                      alt={photo.caption || 'A photo from the event'}
                      loading="lazy"
                      className="aspect-[4/3] h-auto w-full object-cover"
                    />
                  </a>
                  <div className="space-y-2 p-3">
                    <p className="text-sm text-ink">{photo.caption || ' '}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <PhotoLike
                        photoId={photo.id}
                        likes={likes.counts.get(photo.id) ?? 0}
                        liked={likes.mine.has(photo.id)}
                      />
                      <a
                        href={`/api/photos/${photo.id}?download=1`}
                        download
                        aria-label={`Download the photo ${photo.caption || ''}`.trim()}
                        className="inline-flex min-h-9 items-center rounded-full border border-line px-3 text-sm font-semibold text-primary no-underline"
                      >
                        Save
                      </a>
                    </div>
                    {config.features.comments ? (
                      <details open={openId === photo.id}>
                        <summary className="cursor-pointer text-sm font-semibold text-ink">
                          Comments ({comments.length})
                        </summary>
                        <ul className="mt-2 space-y-2">
                          {comments.map((c) => (
                            <li key={c.id} className="rounded-lg bg-canvas p-2 text-sm">
                              <p className="text-ink">{c.text}</p>
                              <p className="text-xs text-ink-soft">{c.name}</p>
                            </li>
                          ))}
                        </ul>
                        {me ? (
                          <form
                            action="/api/photos/social"
                            method="post"
                            className="mt-2 space-y-2"
                          >
                            <input type="hidden" name="action" value="comment" />
                            <input type="hidden" name="photoId" value={photo.id} />
                            <label className="block text-sm font-semibold text-ink">
                              Add a comment
                              <input
                                name="text"
                                required
                                maxLength={MAX_COMMENT}
                                className="mt-1 block min-h-11 w-full rounded-lg border border-line bg-canvas px-3 font-normal text-ink"
                              />
                            </label>
                            <button
                              type="submit"
                              className="min-h-10 rounded-lg bg-primary px-4 text-sm font-bold text-on-primary"
                            >
                              Post comment
                            </button>
                          </form>
                        ) : (
                          <p className="mt-2 text-sm text-ink-soft">
                            To comment, choose your name first.{' '}
                            <Link
                              href="/welcome?next=/photos"
                              className="font-semibold text-primary"
                            >
                              Find my name
                            </Link>
                          </p>
                        )}
                      </details>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <noscript>
        <p className="rounded-lg border border-warning p-3 text-sm text-warning">
          Sharing photos needs JavaScript switched on, because each photo is shrunk on your phone
          before it is sent.
        </p>
      </noscript>
    </div>
  );
}
