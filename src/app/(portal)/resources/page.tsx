import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getEventConfig } from '@/lib/config';
import { isPlaceholderUrl } from '@/lib/placeholder';

export const metadata: Metadata = { title: 'Resources' };

/**
 * Rendered on each request, not frozen into the build. The whole point of
 * this portal is that one build can serve another event by swapping
 * config/event.json, and a prerendered page would keep the old links.
 */
export const dynamic = 'force-dynamic';

/**
 * The take away page. Everything comes from the resources list in
 * config/event.json, so adding a link needs no code change.
 */
export default function ResourcesPage() {
  const config = getEventConfig();
  if (!config.features.resources) notFound();

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-ink">Resources</h1>
        <p className="mt-1 text-ink-soft">
          Slides, guides and photos to take back to your team. Links open in a new tab.
        </p>
      </header>

      {config.resources.length === 0 ? (
        <p className="rounded-lg border border-line bg-surface p-4 text-ink-soft">
          Nothing has been published yet. Check back after Day 3.
        </p>
      ) : (
        <ul className="space-y-2">
          {config.resources.map((resource) =>
            // Photos with no album link yet: the photo wall is the album.
            isPlaceholderUrl(resource.url) &&
            config.features.photoWall &&
            /photo/i.test(`${resource.id} ${resource.title}`) ? (
              <li key={resource.id}>
                <Link
                  href="/photos"
                  className="block rounded-lg border border-line bg-surface p-4 no-underline hover:border-primary focus-visible:border-primary"
                >
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="font-bold text-ink">{resource.title}</span>
                    <span className="shrink-0 text-xs font-semibold uppercase text-ink-soft">
                      Photo wall
                    </span>
                  </span>
                  <span className="mt-1 block text-sm text-ink-soft">
                    Everything shared and approved so far, on the Photos page.
                  </span>
                </Link>
              </li>
            ) : isPlaceholderUrl(resource.url) ? (
              // Not published yet: shown, so people know it is coming, but
              // not a link to a page that does not exist.
              <li
                key={resource.id}
                className="block rounded-lg border border-dashed border-line bg-surface p-4"
              >
                <span className="flex items-baseline justify-between gap-3">
                  <span className="font-bold text-ink">{resource.title}</span>
                  <span className="shrink-0 text-xs font-semibold uppercase text-ink-soft">
                    Coming soon
                  </span>
                </span>
                {resource.description ? (
                  <span className="mt-1 block text-sm text-ink-soft">{resource.description}</span>
                ) : null}
              </li>
            ) : (
              <li key={resource.id} className="rounded-lg border border-line bg-surface">
                <a
                  href={resource.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-lg p-4 no-underline hover:bg-muted/40 focus-visible:bg-muted/40"
                >
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="font-bold text-ink">{resource.title}</span>
                    <span className="shrink-0 text-xs font-semibold uppercase text-ink-soft">
                      {resource.files.length > 0
                        ? 'Everything in one go'
                        : resource.kind === 'file'
                          ? 'Download'
                          : 'Link'}
                    </span>
                  </span>
                  {resource.description ? (
                    <span className="mt-1 block text-sm text-ink-soft">{resource.description}</span>
                  ) : null}
                </a>
                {resource.files.length > 0 ? (
                  <details className="border-t border-line">
                    <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-ink">
                      Or one at a time ({resource.files.length})
                    </summary>
                    <ul className="divide-y divide-line px-4 pb-2">
                      {resource.files.map((f) => (
                        <li key={`${f.title}-${f.url}`}>
                          <a
                            href={f.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-between gap-3 py-2.5 text-ink no-underline hover:text-primary"
                          >
                            <span className="min-w-0">{f.title}</span>
                            <span aria-hidden="true" className="shrink-0 text-ink-soft">
                              ↗
                            </span>
                          </a>
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  );
}
