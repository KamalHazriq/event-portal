import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { AutoRefresh } from '@/components/AutoRefresh';
import { getData } from '@/data';
import type { PhotoStatus } from '@/data/types';
import { requireAdmin } from '@/lib/admin-guard';
import { getEventConfig } from '@/lib/config';
import {
  approveAllWaiting,
  reviewPhoto,
  setPhotoLayout,
  setPhotoModeration,
  showSlideshow,
} from '@/modules/photos/actions';
import {
  moderationOn,
  PHOTO_KEYS,
  PHOTO_LAYOUT_INFO,
  PHOTO_LAYOUTS,
  resolvePhotoLayout,
} from '@/modules/photos/logic';
import { localClock } from '@/modules/reports/logic';
import { SCREEN_KEYS } from '@/modules/big-screen/logic';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Photo wall' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const TABS: { id: PhotoStatus; label: string }[] = [
  { id: 'pending', label: 'Waiting' },
  { id: 'approved', label: 'On the wall' },
  { id: 'rejected', label: 'Rejected' },
];

export default async function PhotosAdminPage({ searchParams }: { searchParams: SearchParams }) {
  await requireAdmin('/admin/photos');
  const config = getEventConfig();
  if (!config.features.photoWall) notFound();

  const params = await searchParams;
  const raw = typeof params.status === 'string' ? params.status : 'pending';
  const status: PhotoStatus = raw === 'approved' || raw === 'rejected' ? raw : 'pending';

  const data = getData();
  const [all, moderationSetting, layoutSetting, screenView] = await Promise.all([
    data.photos.list(),
    data.settings.get(PHOTO_KEYS.moderation),
    data.settings.get(PHOTO_KEYS.layout),
    data.settings.get(SCREEN_KEYS.view),
  ]);
  const onScreen = screenView === 'photos';
  const moderated = moderationOn(moderationSetting);
  const layout = resolvePhotoLayout(layoutSetting);
  const counts = Object.fromEntries(
    TABS.map((t) => [t.id, all.filter((p) => p.status === t.id).length]),
  );
  const shown = all.filter((p) => p.status === status);

  const button = 'min-h-11 flex-1 rounded-lg px-2 text-sm font-semibold';

  return (
    <div className="space-y-5">
      {/* New photos arrive while the desk is watching this page. */}
      <AutoRefresh intervalMs={20_000} enabled={status === 'pending'} />

      <div>
        <h1 className="text-2xl font-bold text-ink">Photo wall</h1>
        <p className="mt-1 text-ink-soft">
          {moderated
            ? 'Every photo waits here until someone approves it. Approved photos play on the big screen.'
            : 'Approval is off: new photos go straight onto the big screen. Hide one by rejecting it.'}{' '}
          Attendees share them at{' '}
          <Link href="/photos" className="font-semibold text-primary">
            /photos
          </Link>
          , as many as they like.
        </p>
      </div>

      <form
        action={setPhotoModeration}
        className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 ${
          moderated ? 'border-line bg-surface' : 'border-warning bg-warning/10'
        }`}
      >
        <input type="hidden" name="mode" value={moderated ? 'off' : 'on'} />
        <p className="text-ink">
          <span className="font-bold">Approval first: {moderated ? 'on' : 'off'}.</span>{' '}
          <span className="text-ink-soft">
            {moderated
              ? 'Turn it off to let photos go straight up, for example at dinner.'
              : 'Turn it on again to check each photo before the room sees it.'}
          </span>
        </p>
        <button
          type="submit"
          className="min-h-11 rounded-lg border border-line px-4 font-semibold text-ink"
        >
          {moderated ? 'Turn approval off' : 'Turn approval on'}
        </button>
      </form>

      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((tab) => (
          <Link
            key={tab.id}
            href={`/admin/photos?status=${tab.id}`}
            aria-current={tab.id === status ? 'page' : undefined}
            className={[
              'inline-flex min-h-11 items-center rounded-lg border px-3 text-sm font-semibold no-underline',
              tab.id === status
                ? 'border-primary bg-primary text-on-primary'
                : 'border-line bg-surface text-ink',
            ].join(' ')}
          >
            {tab.label} ({counts[tab.id]})
          </Link>
        ))}
        {status === 'pending' && shown.length > 1 ? (
          <form action={approveAllWaiting} className="sm:ml-auto">
            <button
              type="submit"
              className="min-h-11 rounded-lg border border-line px-3 text-sm font-semibold text-ink"
            >
              Approve all {shown.length}
            </button>
          </form>
        ) : null}
      </div>

      {shown.length === 0 ? (
        <p className="rounded-xl border border-line bg-surface p-4 text-ink-soft">
          {status === 'pending'
            ? 'Nothing waiting. New photos appear here by themselves.'
            : 'Nothing here.'}
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {shown.map((photo) => (
            <li key={photo.id} className="overflow-hidden rounded-xl border border-line bg-surface">
              <a href={`/api/photos/${photo.id}`} target="_blank" rel="noopener" className="block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/photos/${photo.id}?size=thumb`}
                  alt={photo.caption || 'A shared photo'}
                  loading="lazy"
                  className="aspect-[4/3] w-full bg-muted object-cover"
                />
              </a>
              <div className="p-2">
                <p className="truncate text-sm font-semibold text-ink">
                  {photo.caption || 'No caption'}
                </p>
                <p className="text-xs text-ink-soft">
                  {localClock(photo.createdAt, config.event.timezone)},{' '}
                  {Math.round(photo.sizeBytes / 1024)} KB
                </p>
                <div className="mt-2 flex gap-1">
                  {photo.status !== 'approved' ? (
                    <form action={reviewPhoto} className="flex flex-1">
                      <input type="hidden" name="id" value={photo.id} />
                      <input type="hidden" name="decision" value="approved" />
                      <button type="submit" className={`${button} bg-primary text-on-primary`}>
                        Approve
                      </button>
                    </form>
                  ) : null}
                  {photo.status !== 'rejected' ? (
                    <form action={reviewPhoto} className="flex flex-1">
                      <input type="hidden" name="id" value={photo.id} />
                      <input type="hidden" name="decision" value="rejected" />
                      <button type="submit" className={`${button} border border-line text-ink`}>
                        {photo.status === 'approved' ? 'Take down' : 'Reject'}
                      </button>
                    </form>
                  ) : (
                    <form action={reviewPhoto} className="flex flex-1">
                      <input type="hidden" name="id" value={photo.id} />
                      <input type="hidden" name="decision" value="delete" />
                      <button type="submit" className={`${button} border border-line text-ink`}>
                        Delete
                      </button>
                    </form>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <section className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-line bg-surface p-4">
          <h2 className="font-bold text-ink">On the big screen</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Choose how the photos are laid out. A new photo always pops up large for a few seconds
            first, then joins the wall.
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2" role="group" aria-label="Photo layout">
            {PHOTO_LAYOUTS.map((option) => (
              <form key={option} action={setPhotoLayout}>
                <input type="hidden" name="layout" value={option} />
                <button
                  type="submit"
                  aria-pressed={option === layout}
                  title={PHOTO_LAYOUT_INFO[option].description}
                  className={`min-h-11 w-full rounded-lg border px-2 text-sm font-semibold ${
                    option === layout
                      ? 'border-primary bg-primary/15 text-ink'
                      : 'border-line text-ink-soft hover:text-ink'
                  }`}
                >
                  {PHOTO_LAYOUT_INFO[option].title}
                </button>
              </form>
            ))}
          </div>
          {onScreen ? (
            <p
              className="mt-3 flex min-h-11 items-center gap-2 font-semibold text-ink"
              role="status"
            >
              <span aria-hidden="true" className="size-2.5 rounded-full bg-live" />
              The photo wall is on the big screen now.
            </p>
          ) : (
            <form action={showSlideshow} className="mt-3">
              <button
                type="submit"
                className="min-h-11 rounded-lg bg-primary px-4 font-bold text-on-primary"
              >
                Show the photo wall now
              </button>
            </form>
          )}
        </div>
        <div className="rounded-xl border border-line bg-surface p-4">
          <h2 className="font-bold text-ink">After the event</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Every approved photo in one zip ({counts.approved}), with their captions.
          </p>
          {/* A file download, so a plain link: next/link would try to navigate. */}
          <a
            href="/api/photos/zip"
            download
            className="mt-3 inline-flex min-h-11 items-center rounded-lg border border-line px-4 font-semibold text-ink no-underline"
          >
            Download approved photos
          </a>
        </div>
      </section>
    </div>
  );
}
