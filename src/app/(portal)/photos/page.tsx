import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';

import { getData } from '@/data';
import { getEventConfig } from '@/lib/config';
import { DEVICE_COOKIE, readDeviceId } from '@/lib/device';
import { PhotoUploader } from '@/modules/photos/components/PhotoUploader';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Share a photo' };

/** Attendees share photos for the big screen slideshow. */
export default async function PhotosPage() {
  const config = getEventConfig();
  if (!config.features.photoWall) notFound();

  const store = await cookies();
  const deviceId = readDeviceId(store.get(DEVICE_COOKIE)?.value);
  const alreadySent = deviceId ? await getData().photos.countByDevice(deviceId) : 0;

  return (
    <div className="space-y-5 py-2">
      <div>
        <p className="eyebrow">Photo wall</p>
        <h1 className="mt-2 text-2xl font-bold text-ink sm:text-3xl">Share a photo</h1>
        <p className="mt-3 text-ink-soft">
          Your photos play on the big screen during breaks and dinner, once an organiser has checked
          them.
        </p>
      </div>

      <PhotoUploader alreadySent={alreadySent} />

      <noscript>
        <p className="rounded-lg border border-warning p-3 text-sm text-warning">
          Sharing photos needs JavaScript switched on, because each photo is shrunk on your phone
          before it is sent.
        </p>
      </noscript>
    </div>
  );
}
