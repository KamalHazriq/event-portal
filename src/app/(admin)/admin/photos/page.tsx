import type { Metadata } from 'next';

import { requireAdmin } from '@/lib/admin-guard';
import { PhotosPreview } from '@/modules/previews/components/PhotosPreview';
import { PreviewBanner } from '@/modules/previews/components/PreviewBanner';
import { mockPhotos } from '@/modules/previews/mock-data';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Photo wall' };

export default async function PhotosPage() {
  await requireAdmin('/admin/photos');

  const photos = mockPhotos();
  const approved = photos.filter((p) => p.status === 'approved').length;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-ink">Photo wall</h1>
        <p className="mt-1 text-ink-soft">
          Every photo waits here until someone approves it. Approved photos play on the big screen
          during breaks and dinner. Up to 10 photos per phone.
        </p>
      </header>

      <PreviewBanner module="Extra, photo wall">
        The tiles are coloured blocks standing in for photos. Storing real photos of leaders still
        needs a GRC answer before this is built.
      </PreviewBanner>

      <PhotosPreview photos={photos} />

      <section className="rounded-xl border border-line bg-muted p-4 text-sm">
        <p className="font-semibold text-ink">After the event</p>
        <p className="mt-1 text-ink-soft">
          Download every approved photo as one zip file ({approved} in this preview).
        </p>
        <button
          type="button"
          disabled
          className="mt-2 min-h-11 rounded-lg border border-line px-4 font-semibold text-ink opacity-50"
        >
          Download approved photos
        </button>
      </section>
    </div>
  );
}
