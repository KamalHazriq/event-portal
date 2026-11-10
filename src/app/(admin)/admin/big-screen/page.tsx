import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { requireAdmin } from '@/lib/admin-guard';
import { getEventConfig } from '@/lib/config';
import { setHideNames, setScreenView } from '@/modules/big-screen/actions';
import { ScaledPreview } from '@/modules/big-screen/components/ScaledPreview';
import { readScreenSettings } from '@/modules/big-screen/load';
import { availableScreenViews, SCREEN_VIEW_INFO } from '@/modules/big-screen/logic';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Big screen' };

/** Views the brief wants on the big screen that arrive with later modules. */
const LATER = [{ title: 'Photo slideshow', href: '/admin/photos' }];

export default async function BigScreenControlPage() {
  await requireAdmin('/admin/big-screen');

  const config = getEventConfig();
  const settings = await readScreenSettings();
  const views = availableScreenViews(config.features);

  if (!config.features.bigScreen) notFound();

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-ink">Big screen</h1>
        <p className="mt-1 text-ink-soft">
          Pick what the ballroom projector shows. It changes within a few seconds.
        </p>
      </header>

      <section>
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-ink-soft">
          On the projector now: {SCREEN_VIEW_INFO[settings.view].title}
        </h2>
        {/* A new address per view, so the preview reloads at once on a switch. */}
        <ScaledPreview src={`/screen?view=${settings.view}`} />
      </section>

      <ul className="grid gap-3 sm:grid-cols-2">
        {views.map((view) => {
          const info = SCREEN_VIEW_INFO[view];
          const active = view === settings.view;
          return (
            <li key={view}>
              <form action={setScreenView} className="h-full">
                <input type="hidden" name="view" value={view} />
                <button
                  type="submit"
                  aria-pressed={active}
                  className={[
                    'block h-full min-h-11 w-full rounded-xl bg-surface p-4 text-left',
                    active ? 'border-2 border-success' : 'border border-line hover:border-primary',
                  ].join(' ')}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-bold text-ink">{info.title}</span>
                    {active ? (
                      <span className="rounded bg-success px-2 py-0.5 text-xs font-bold text-canvas">
                        On screen
                      </span>
                    ) : (
                      <span className="text-xs font-semibold text-primary">Show this</span>
                    )}
                  </span>
                  <span className="mt-1 block text-sm text-ink-soft">{info.description}</span>
                  <span className="mt-2 block text-xs text-ink-soft">{info.whenToUse}</span>
                </button>
              </form>
            </li>
          );
        })}
      </ul>

      <section className="rounded-xl border border-line bg-surface p-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-ink-soft">Arrivals</h2>
        <p className="mt-1 text-ink">
          Names on the welcome cards are{' '}
          <span className="font-bold">{settings.hideNames ? 'hidden' : 'shown'}</span>.
          {settings.hideNames
            ? ' Only the counter is on screen.'
            : ' The secretariat never get a card.'}
        </p>
        <form action={setHideNames} className="mt-3">
          <input type="hidden" name="hideNames" value={settings.hideNames ? 'false' : 'true'} />
          <button
            type="submit"
            className="min-h-11 rounded-lg border border-line px-4 font-semibold text-ink"
          >
            {settings.hideNames ? 'Show names' : 'Hide names, counter only'}
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-line bg-muted p-4 text-sm">
        <h2 className="font-bold text-ink">Setting up the projector</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-ink">
          <li>
            On the laptop plugged into the projector, open{' '}
            <a
              href="/screen"
              target="_blank"
              rel="noopener"
              className="font-mono font-semibold text-primary"
            >
              /screen
            </a>
            .
          </li>
          <li>Sign in with the PIN, using the label screen.</li>
          <li>Press F11 for full screen. Leave it open all day.</li>
        </ol>
        <p className="mt-3 text-ink-soft">
          A second screen that should always show one thing, such as a monitor by the registration
          desk, can open one view directly:{' '}
          {views.map((view, i) => (
            <span key={view}>
              {i > 0 ? ', ' : ''}
              <a
                href={`/screen/${view}`}
                target="_blank"
                rel="noopener"
                className="font-mono text-primary"
              >
                /screen/{view}
              </a>
            </span>
          ))}
          .
        </p>
      </section>

      <section className="text-sm text-ink-soft">
        <p>
          Coming with later modules:{' '}
          {LATER.map((item, i) => (
            <span key={item.href}>
              {i > 0 ? ' and ' : ''}
              <Link href={item.href} className="font-semibold text-primary">
                {item.title}
              </Link>
            </span>
          ))}
          , a preview for now.
        </p>
      </section>
    </div>
  );
}
