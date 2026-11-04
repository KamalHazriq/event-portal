import Link from 'next/link';

/**
 * Shared by the site wide not-found page and the one for a session that does
 * not exist, so both read the same way.
 */
export function NotFoundPanel({
  heading = 'We cannot find that page',
  message = 'The link may be out of date, or the page may have been renamed.',
}: {
  heading?: string;
  message?: string;
}) {
  return (
    <div className="space-y-4 py-8">
      <h1 className="text-2xl font-bold text-ink">{heading}</h1>
      <p className="text-ink-soft">{message}</p>
      <div className="flex flex-wrap gap-3">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center rounded-lg bg-primary px-4 py-2.5 font-bold text-on-primary no-underline"
        >
          Go to the home page
        </Link>
        <Link
          href="/agenda"
          className="inline-flex min-h-11 items-center rounded-lg border border-line bg-surface px-4 py-2.5 font-bold text-ink no-underline"
        >
          See the agenda
        </Link>
      </div>
    </div>
  );
}
