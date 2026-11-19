import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';

import { getData } from '@/data';
import { getEventConfig } from '@/lib/config';
import { DEVICE_COOKIE, readDeviceId } from '@/lib/device';
import { PhotoUploader } from '@/modules/photos/components/PhotoUploader';
import { moderationOn, PHOTO_KEYS } from '@/modules/photos/logic';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Share a photo' };

/** Attendees share photos for the big screen slideshow. */
export default async function PhotosPage() {
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

  return (
    <div className="space-y-5 py-2">
      <div>
        <p className="eyebrow">Photo wall</p>
        <h1 className="mt-2 text-2xl font-bold text-ink sm:text-3xl">Share a photo</h1>
        <p className="mt-3 text-ink-soft">
          Your photos play on the big screen during breaks and dinner
          {moderated ? ', once an organiser has checked them' : ''}. Share as many as you like.
        </p>
      </div>

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
            Nothing yet. Yours could be the first.
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {onTheWall.slice(0, 60).map((photo) => (
              <li
                key={photo.id}
                className="overflow-hidden rounded-lg border border-line bg-surface"
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
                    className="aspect-square h-auto w-full object-cover"
                  />
                </a>
                {photo.caption ? (
                  <p className="truncate px-2 py-1.5 text-xs text-ink-soft">{photo.caption}</p>
                ) : null}
              </li>
            ))}
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
