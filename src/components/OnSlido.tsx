import Link from 'next/link';

import { getEventConfig } from '@/lib/config';

import { slidoLink } from './ruled/RuledChrome';

/**
 * In place of the portal's own polls and questions while Slido is in use,
 * so an old link, a QR or an alert never lands on a bare "not found".
 */
export function OnSlido({ what }: { what: 'polls' | 'questions' }) {
  const config = getEventConfig();
  const href = slidoLink(config);
  const code = config.integrations.slido?.eventCode;
  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <h1 className="text-2xl font-bold text-ink">
        {what === 'polls' ? 'Polls are on Slido today' : 'Questions are on Slido today'}
      </h1>
      <p className="mt-2 text-ink-soft">
        {what === 'polls'
          ? 'Vote in Slido, the same as the rest of the room.'
          : 'Ask and vote on questions in Slido, the same as the rest of the room.'}
        {code ? (
          <>
            {' '}
            The code is <strong className="font-mono text-ink">{code}</strong>.
          </>
        ) : null}
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center rounded-lg bg-primary px-5 font-bold text-on-primary no-underline"
          >
            Join Slido
          </a>
        ) : null}
        <Link
          href="/agenda"
          className="inline-flex min-h-11 items-center rounded-lg border border-line px-5 font-semibold text-ink no-underline"
        >
          Back to the agenda
        </Link>
      </div>
    </section>
  );
}
