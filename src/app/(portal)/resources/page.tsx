import type { Metadata } from 'next';
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
            isPlaceholderUrl(resource.url) ? (
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
              <li key={resource.id}>
                <a
                  href={resource.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-lg border border-line bg-surface p-4 no-underline hover:border-primary focus-visible:border-primary"
                >
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="font-bold text-ink">{resource.title}</span>
                    <span className="shrink-0 text-xs font-semibold uppercase text-ink-soft">
                      {resource.kind === 'file' ? 'Download' : 'Link'}
                    </span>
                  </span>
                  {resource.description ? (
                    <span className="mt-1 block text-sm text-ink-soft">{resource.description}</span>
                  ) : null}
                </a>
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  );
}
