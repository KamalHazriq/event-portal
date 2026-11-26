import { CuePanel } from '@/modules/stage/components/CuePanel';
import { CountdownPanel } from '@/modules/stage/components/CountdownPanel';
import { DrawPanel } from '@/modules/stage/components/DrawPanel';
import { PickerPanel } from '@/modules/stage/components/PickerPanel';
import { PollPanel } from '@/modules/stage/components/PollPanel';
import { QaPanel } from '@/modules/stage/components/QaPanel';
import { StageKeys } from '@/modules/stage/components/StageKeys';
import { LoopControls } from '@/modules/loop/components/LoopControls';
import {
  buildLoopItems,
  LOOP_COMMAND_KEY,
  LOOP_KEY,
  parseLoop,
  parseLoopCommand,
} from '@/modules/loop/logic';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { requireAdmin } from '@/lib/admin-guard';
import { getEventConfig } from '@/lib/config';
import { setPhotoDay, setPhotoLayout } from '@/modules/photos/actions';
import {
  PHOTO_KEYS,
  PHOTO_LAYOUT_INFO,
  PHOTO_LAYOUTS,
  resolvePhotoLayout,
} from '@/modules/photos/logic';
import { getData } from '@/data';
import {
  podiumControl,
  setFeedbackTarget,
  setHideNames,
  setScreenCalm,
  setScreenTalk,
  setScreenView,
} from '@/modules/big-screen/actions';
import { buildAgenda } from '@/modules/schedule/logic';
import { AutoRefresh } from '@/components/AutoRefresh';
import { pageNowParam } from '@/lib/test-clock-server';
import { resolveEventNow } from '@/lib/time';
import { suggestScreenView } from '@/modules/big-screen/suggest';
import {
  COMMENT_KEYS,
  commentsNeedApproval,
  isInteractiveSession,
  resolveCommentLayout,
} from '@/modules/talk/logic';
import { setCommentApproval, setCommentLayout } from '@/modules/talk/actions';
import { ScaledPreview } from '@/modules/big-screen/components/ScaledPreview';
import { readScreenSettings } from '@/modules/big-screen/load';
import {
  availableScreenViews,
  clampPodiumStep,
  parsePodiumSize,
  PODIUM_SIZES,
  podiumGroups,
  SCREEN_KEYS,
  SCREEN_VIEW_INFO,
} from '@/modules/big-screen/logic';
import { localClock } from '@/modules/reports/logic';
import { loadScoreboard } from '@/modules/points/server';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Stage control' };

export default async function BigScreenControlPage() {
  await requireAdmin('/admin/big-screen');

  const config = getEventConfig();
  const settings = await readScreenSettings();
  const views = availableScreenViews(config.features);
  const photoLayout = resolvePhotoLayout(await getData().settings.get(PHOTO_KEYS.layout));
  const loopContent = parseLoop(await getData().settings.get(LOOP_KEY));
  const loopCommand = parseLoopCommand(await getData().settings.get(LOOP_COMMAND_KEY));
  const loopItems = buildLoopItems({ ...loopContent, liveFacts: false });
  const photoDay = (await getData().settings.get(PHOTO_KEYS.day)) ?? 'all';
  const [chosenRaw, commentLayoutRaw, approvalRaw] = await Promise.all([
    getData().settings.get(COMMENT_KEYS.screenSession),
    getData().settings.get(COMMENT_KEYS.screenLayout),
    getData().settings.get(COMMENT_KEYS.approval),
  ]);
  const talks = buildAgenda(config).sessions.filter((s) => isInteractiveSession(s));
  const chosenTalk = talks.some((t) => t.id === chosenRaw) ? (chosenRaw as string) : 'auto';
  const commentLayout = resolveCommentLayout(commentLayoutRaw);
  const commentsApproval = commentsNeedApproval(approvalRaw);

  if (!config.features.bigScreen) notFound();

  // The podium: places and ties, so the MC knows what they are about to reveal.
  const podiumSize = parsePodiumSize(await getData().settings.get(SCREEN_KEYS.podiumSize));
  const podiumGroupsNow = config.features.leaderboard
    ? podiumGroups((await loadScoreboard({ shared: true })).people, podiumSize)
    : [];
  const podiumStep = clampPodiumStep(
    Number((await getData().settings.get(SCREEN_KEYS.podiumStep)) ?? 0),
    podiumGroupsNow.length,
  );
  const feedbackTarget = (await getData().settings.get(SCREEN_KEYS.feedbackTarget)) ?? 'auto';
  const feedbackSessions = buildAgenda(config).sessions.filter(
    (s) => s.feedbackEnabled && !s.hidden,
  );
  const podiumTies = podiumGroupsNow.filter((g) => g.people.length > 1);
  // The next button says which place comes up, from the last one to the first.
  const nextGroup = podiumGroupsNow[podiumGroupsNow.length - podiumStep - 1];
  const placeWord = (n: number) => (n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`);
  const belowTop3 = podiumGroupsNow.filter((g) => g.rank > 3);
  const restLabel =
    belowTop3.length > 0 && podiumStep < belowTop3.length
      ? `Reveal ${placeWord(belowTop3[0]!.rank)} to ${placeWord(belowTop3[belowTop3.length - 1]!.rank)} at once`
      : null;
  const nextLabel = nextGroup
    ? `Reveal ${placeWord(nextGroup.rank)} place${nextGroup.people.length > 1 ? ` (${nextGroup.people.length} tied)` : ''}`
    : 'All revealed';

  // A nudge from the clock and the agenda. The device test clock applies here too,
  // so it can be tried before the day.
  const now = resolveEventNow({
    timezone: config.event.timezone,
    overrideParam: await pageNowParam(null),
  });
  const suggestion = suggestScreenView(buildAgenda(config), now, views);
  // Who last changed something, so two people on the console see each other.
  const lastEntry = (
    await getData()
      .activity.recent(1)
      .catch(() => [])
  )[0];
  const lastChange = lastEntry
    ? `${lastEntry.operator}: ${lastEntry.action}, ${localClock(lastEntry.at, config.event.timezone)}`
    : null;

  return (
    <div className="space-y-5">
      <AutoRefresh intervalMs={30_000} />
      <StageKeys />
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-bold text-ink">Stage control</h1>
        <p className="text-sm text-ink-soft">
          For the MC and the floor manager, on a phone or a laptop. Several people can have this
          open: the screen follows whoever pressed last.
        </p>
      </header>

      <CuePanel
        current={settings.view}
        available={views}
        suggestion={suggestion}
        lastChange={lastChange}
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-start">
        <section aria-label="Projector preview">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-ink-soft">
            On the projector now: {SCREEN_VIEW_INFO[settings.view].title}
          </h2>
          {/* A new address per view, so the preview reloads at once on a switch. */}
          <ScaledPreview src={`/screen?view=${settings.view}`} />
        </section>

        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {views.map((view, index) => {
            const info = SCREEN_VIEW_INFO[view];
            const active = view === settings.view;
            const suggested = suggestion?.view === view && !active;
            return (
              <li key={view}>
                <form action={setScreenView} className="h-full">
                  <input type="hidden" name="view" value={view} />
                  <button
                    type="submit"
                    aria-pressed={active}
                    title={`${info.description} ${info.whenToUse}.`}
                    data-tile-index={index < 9 ? index + 1 : undefined}
                    className={[
                      'relative block h-full min-h-14 w-full rounded-xl bg-surface px-3 py-2 text-left',
                      active
                        ? 'border-2 border-success'
                        : suggested
                          ? 'border-2 border-accent'
                          : 'border border-line hover:border-primary',
                    ].join(' ')}
                  >
                    <span className="block font-bold leading-tight text-ink">{info.title}</span>
                    <span className="block text-xs font-semibold">
                      {active ? (
                        <span className="text-success">On screen</span>
                      ) : suggested ? (
                        <span className="text-accent">Suggested now</span>
                      ) : (
                        <span className="text-ink-soft">{info.whenToUse}</span>
                      )}
                    </span>
                    {index < 9 ? (
                      <kbd className="absolute right-2 top-2 rounded border border-line px-1.5 text-xs text-ink-soft">
                        {index + 1}
                      </kbd>
                    ) : null}
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      </div>

      {settings.view === 'countdown' ? <CountdownPanel /> : null}
      {settings.view === 'lucky-draw' && config.features.luckyDraw ? <DrawPanel /> : null}
      {settings.view === 'name-picker' ? <PickerPanel /> : null}
      {settings.view === 'qa' && config.features.qa ? <QaPanel /> : null}
      {settings.view === 'poll' && config.features.polls ? <PollPanel /> : null}

      {settings.view === 'loop' ? (
        <LoopControls items={loopItems} manual={loopCommand.manual} />
      ) : null}

      {config.features.feedback && settings.view === 'feedback' ? (
        <section className="rounded-xl border border-line bg-surface p-4">
          <h2 className="text-sm font-bold uppercase tracking-wide text-ink-soft">Feedback QR</h2>
          <p className="mt-1 text-sm text-ink-soft">
            A big QR that opens the feedback form. Automatic means the session on now, or the one
            that just finished. The rest of the screen stays the same, only the QR changes.
          </p>
          <form action={setFeedbackTarget} className="mt-3 flex flex-wrap items-end gap-2">
            <label className="min-w-0 flex-1 text-sm font-semibold text-ink">
              The QR is for
              <select
                name="target"
                defaultValue={feedbackTarget}
                className="mt-1 block min-h-11 w-full rounded-lg border border-line bg-canvas px-3 text-ink"
              >
                <option value="auto">Automatic: the session now or just finished</option>
                <option value="event">The whole summit</option>
                {feedbackSessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.dayLabel}: {s.title}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              className="min-h-11 rounded-lg bg-primary px-5 font-bold text-on-primary"
            >
              Show it on the screen
            </button>
          </form>
        </section>
      ) : null}

      {config.features.leaderboard && settings.view === 'podium' ? (
        <section className="rounded-xl border border-line bg-surface p-4">
          <h2 className="text-sm font-bold uppercase tracking-wide text-ink-soft">Podium reveal</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Reveals the winners one place at a time, from the bottom up, with confetti and a fanfare
            for the winner. Pick how many places, then tap the Reveal button on stage. People with
            the same points share a place, and a tie at the cut-off shows everyone tied.
          </p>
          <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="How many places">
            {PODIUM_SIZES.map((n) => (
              <form key={n} action={podiumControl}>
                <input type="hidden" name="action" value="size" />
                <input type="hidden" name="size" value={n} />
                <button
                  type="submit"
                  aria-pressed={n === podiumSize}
                  className={[
                    'min-h-11 rounded-lg px-4 font-bold',
                    n === podiumSize
                      ? 'bg-primary text-on-primary'
                      : 'border border-line bg-surface text-ink',
                  ].join(' ')}
                >
                  Top {n}
                </button>
              </form>
            ))}
          </div>
          <p className="mt-3 text-sm text-ink">
            {podiumGroupsNow.length === 0
              ? 'Nobody has points yet.'
              : `${podiumStep} of ${podiumGroupsNow.length} places revealed.`}
          </p>
          {podiumTies.length > 0 ? (
            <p className="mt-1 text-sm text-ink-soft">
              Tied:{' '}
              {podiumTies
                .map((g) => `${g.people.length} people share place ${g.rank} (${g.points} points)`)
                .join('; ')}
              . To settle it, spin the Name picker among their names, or let them share the place.
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            {[
              ['next', nextLabel, 'bg-primary text-on-primary'],
              ...(restLabel ? [['rest', restLabel, 'border border-primary text-primary']] : []),
              ['back', 'Hide last', 'border border-line bg-surface text-ink'],
              ['all', 'Show all', 'border border-line bg-surface text-ink'],
              ['reset', 'Start again', 'border border-line bg-surface text-ink'],
            ].map(([action, label, look]) => (
              <form key={action} action={podiumControl}>
                <input type="hidden" name="action" value={action} />
                <button type="submit" className={`min-h-11 rounded-lg px-4 font-bold ${look}`}>
                  {label}
                </button>
              </form>
            ))}
          </div>
          <p className="mt-2 text-xs text-ink-soft">
            Every button also puts the podium on the projector. Click the projector screen once
            beforehand so the browser allows sound.
          </p>
        </section>
      ) : null}

      {config.features.photoWall && settings.view === 'photos' ? (
        <section className="rounded-xl border border-line bg-surface p-4">
          <h2 className="text-sm font-bold uppercase tracking-wide text-ink-soft">
            Photo wall layout
          </h2>
          <p className="mt-1 text-sm text-ink-soft">
            How the Photo wall view shows the approved photos. A new photo always pops up large for
            a few seconds first. Each photo shows how many likes it has.
          </p>
          <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Photos to show">
            {[
              { id: 'all', label: 'All photos' },
              ...config.days.map((d) => ({ id: d.id, label: d.label })),
            ].map((option) => (
              <form key={option.id} action={setPhotoDay}>
                <input type="hidden" name="day" value={option.id} />
                <button
                  type="submit"
                  aria-pressed={option.id === photoDay}
                  className={[
                    'min-h-11 rounded-full border px-4 text-sm font-semibold',
                    option.id === photoDay
                      ? 'border-primary bg-primary text-on-primary'
                      : 'border-line text-ink hover:border-primary',
                  ].join(' ')}
                >
                  {option.label}
                </button>
              </form>
            ))}
          </div>
          <ul className="mt-3 grid gap-2 sm:grid-cols-3">
            {PHOTO_LAYOUTS.map((option) => (
              <li key={option}>
                <form action={setPhotoLayout} className="h-full">
                  <input type="hidden" name="layout" value={option} />
                  <button
                    type="submit"
                    aria-pressed={option === photoLayout}
                    className={[
                      'block h-full min-h-11 w-full rounded-lg border p-3 text-left',
                      option === photoLayout
                        ? 'border-primary bg-primary/10'
                        : 'border-line hover:border-primary',
                    ].join(' ')}
                  >
                    <span className="block font-bold text-ink">
                      {PHOTO_LAYOUT_INFO[option].title}
                      {option === photoLayout ? ' ✓' : ''}
                    </span>
                    <span className="mt-1 block text-sm text-ink-soft">
                      {PHOTO_LAYOUT_INFO[option].description}
                    </span>
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {settings.view === 'qa' || settings.view === 'comments' ? (
        <section className="rounded-xl border border-line bg-surface p-4">
          <h2 className="text-sm font-bold uppercase tracking-wide text-ink-soft">
            Comments, questions and reactions
          </h2>
          <form action={setScreenTalk} className="mt-2 flex flex-wrap items-end gap-2">
            <label className="min-w-0 flex-1 text-sm font-semibold text-ink">
              Which talk the comments and questions are about
              <select
                name="session"
                defaultValue={chosenTalk}
                className="mt-1 block min-h-11 w-full rounded-lg border border-line bg-canvas px-3 font-normal text-ink"
              >
                <option value="auto">Automatic: the talk that is on now</option>
                {talks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.dayLabel}, {t.start}: {t.title}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              className="min-h-11 rounded-lg bg-primary px-4 font-bold text-on-primary"
            >
              Use this talk
            </button>
          </form>
          <p className="mt-2 text-sm text-ink-soft">
            Each question and comment is sent from one talk&apos;s page, so it belongs to that talk.
            The screen shows the ones of the talk chosen here, or of the talk running now when this
            is on Automatic. Lunch, breaks and registration are not on the list: they have none.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <form action={setCommentLayout}>
              <input
                type="hidden"
                name="layout"
                value={commentLayout === 'bubbles' ? 'list' : 'bubbles'}
              />
              <button
                type="submit"
                className="min-h-11 rounded-lg border border-line px-4 text-sm font-semibold text-ink"
              >
                Comments look: {commentLayout === 'bubbles' ? 'bubbles' : 'a list'} (switch to{' '}
                {commentLayout === 'bubbles' ? 'a list' : 'bubbles'})
              </button>
            </form>
            <form action={setCommentApproval}>
              <input type="hidden" name="mode" value={commentsApproval ? 'off' : 'on'} />
              <button
                type="submit"
                className="min-h-11 rounded-lg border border-line px-4 text-sm font-semibold text-ink"
              >
                Comments need approval: {commentsApproval ? 'on' : 'off'}
              </button>
            </form>
          </div>
        </section>
      ) : null}

      <section className="rounded-xl border border-line bg-surface p-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-ink-soft">Effects</h2>
        <p className="mt-1 text-ink">
          Moving background and hexagon wipe are{' '}
          <span className="font-bold">{settings.calm ? 'off (calm mode)' : 'on'}</span>.
          {settings.calm
            ? ' The screen stands still and views change straight away.'
            : ' If the projector laptop stutters, turn on calm mode.'}
        </p>
        <form action={setScreenCalm} className="mt-3">
          <input type="hidden" name="calm" value={settings.calm ? 'false' : 'true'} />
          <button
            type="submit"
            className="min-h-11 rounded-lg border border-line px-4 font-semibold text-ink"
          >
            {settings.calm ? 'Turn the effects on' : 'Calm mode: turn the effects off'}
          </button>
        </form>
      </section>
      {settings.view === 'arrivals' ? (
        <section className="rounded-xl border border-line bg-surface p-4">
          <h2 className="text-sm font-bold uppercase tracking-wide text-ink-soft">Arrivals</h2>
          <p className="mt-1 text-ink">
            Names on the welcome cards are{' '}
            <span className="font-bold">{settings.hideNames ? 'hidden' : 'shown'}</span>.
            {settings.hideNames
              ? ' Only the counter is on screen.'
              : ' Everyone who checks in gets a card.'}
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
      ) : null}

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
        <p className="mt-3 text-ink">
          <span className="font-bold">A shortcut instead of a link:</span> on /screen, in Chrome or
          Edge open the menu, choose Save and share (Chrome) or Apps (Edge), then Install this page
          as an app. You get a desktop icon that opens the big screen full screen on its own. The
          check in kiosk installs the same way from /kiosk.
        </p>
        <p className="mt-3 text-ink">
          <span className="font-bold">Using the same laptop for the secretariat?</span> Plug in the
          projector, set the display to Extend (Windows key and P), open /screen in a new window,
          drag that window onto the projector, then press F11. Keep this admin window on the laptop.
          Signing in on /screen replaces this browser&apos;s desk name, so use a separate browser
          (or a private window) for the projector if you want the names kept apart.
        </p>
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
    </div>
  );
}
