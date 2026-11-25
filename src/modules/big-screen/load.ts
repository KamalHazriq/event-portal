/**
 * Gathers what one projector view needs. Server only: it reads the database.
 *
 * Shared by /screen (which follows the admin's choice) and /screen/<view>
 * (which always shows one view), so both always agree.
 */
import { getData } from '@/data';
import { getEventConfig } from '@/lib/config';
import { shortDepartment } from '@/lib/departments';
import { eventPass, passLink } from '@/lib/event-pass-server';
import { shortName } from '@/modules/points/logic';
import { LAYOUT_COUNT, PHOTO_KEYS, resolvePhotoLayout } from '@/modules/photos/logic';
import {
  COMMENT_KEYS,
  screenComments,
  reactionEmoji,
  SCREEN_COMMENTS,
  SCREEN_REACTION_WINDOW_MS,
  resolveCommentLayout,
} from '@/modules/talk/logic';
import { loadScoreboard } from '@/modules/points/server';
import { logoFor, resolveTheme } from '@/lib/theme';
import type { EventConfig } from '@/lib/event-schema';
import { formatClock, formatShortDate, type EventNow } from '@/lib/time';
import {
  minutesLeftInSession,
  resolveSurprise,
  SURPRISE_KEYS,
  surpriseInstant,
} from '@/modules/admin/logic';
import { arrivalRate, resolveCheckInDay } from '@/modules/check-in/logic';
import { tallyPoll } from '@/modules/polls/logic';
import { QA_KEYS, screenQuestions } from '@/modules/qa/logic';
import { groupDraws, LUCKY_KEYS, resolveExclusions } from '@/modules/lucky-draw/logic';
import { parsePickerState, PICKER_KEY } from '@/modules/name-picker/logic';
import {
  buildAgenda,
  findNowAndNext,
  sessionStatus,
  type ResolvedSession,
} from '@/modules/schedule/logic';

import {
  arrivalCards,
  clampPodiumStep,
  guestCount,
  parsePodiumSize,
  podiumGroups,
  SCREEN_KEYS,
  resolveScreenSettings,
  type ScreenSettings,
  type ScreenView,
} from './logic';
import type {
  ArrivalsView,
  CountdownView,
  CommentsView,
  FeedbackQrView,
  LeaderboardView,
  LuckyDrawView,
  NamePickerView,
  NowNextView,
  PhotosView,
  PollView,
  QuestionsView,
  ScreenSession,
  WelcomeView,
} from './components/ScreenViews';
import type { ComponentProps } from 'react';
import type { PodiumView } from './components/PodiumView';

/**
 * Reaction taps from the last few seconds, for the floating reactions over
 * every view. None when reactions are off, or switched off for the screen.
 */
export async function loadScreenReactions(): Promise<{ id: string; emoji: string }[]> {
  const config = getEventConfig();
  if (!config.features.reactions) return [];
  const data = getData();
  if ((await data.settings.get(COMMENT_KEYS.screenReactions)) === 'off') return [];
  const since = new Date(Date.now() - SCREEN_REACTION_WINDOW_MS).toISOString();
  return (await data.reactions.since(since, 80)).map((r) => ({
    id: r.id,
    emoji: reactionEmoji(r.kind),
  }));
}

export async function readScreenSettings(): Promise<ScreenSettings> {
  const data = getData();
  const [view, hideNames, calm] = await Promise.all([
    data.settings.get(SCREEN_KEYS.view),
    data.settings.get(SCREEN_KEYS.hideNames),
    data.settings.get(SCREEN_KEYS.calm),
  ]);
  return resolveScreenSettings({ view, hideNames, calm });
}

function toScreenSession(s: ResolvedSession): ScreenSession {
  return {
    id: s.id,
    title: s.title,
    room: s.room ?? '',
    start: formatClock(s.start),
    end: formatClock(s.end),
    speakers: s.speakers.map((sp) => sp.name).join(', '),
  };
}

function eventDates(config: EventConfig): string {
  const { startDate, endDate, timezone } = config.event;
  return startDate === endDate
    ? formatShortDate(startDate, timezone)
    : `${formatShortDate(startDate, timezone)} to ${formatShortDate(endDate, timezone)}`;
}

export type ScreenPayload =
  | { view: 'welcome'; props: ComponentProps<typeof WelcomeView> }
  | { view: 'now-next'; props: ComponentProps<typeof NowNextView> }
  | { view: 'arrivals'; props: ComponentProps<typeof ArrivalsView> }
  | { view: 'countdown'; props: ComponentProps<typeof CountdownView> }
  | { view: 'lucky-draw'; props: ComponentProps<typeof LuckyDrawView> }
  | { view: 'name-picker'; props: ComponentProps<typeof NamePickerView> }
  | { view: 'photos'; props: ComponentProps<typeof PhotosView> }
  | { view: 'qa'; props: ComponentProps<typeof QuestionsView> }
  | { view: 'poll'; props: ComponentProps<typeof PollView> }
  | { view: 'leaderboard'; props: ComponentProps<typeof LeaderboardView> }
  | { view: 'comments'; props: ComponentProps<typeof CommentsView> }
  | { view: 'podium'; props: ComponentProps<typeof PodiumView> }
  | { view: 'feedback'; props: ComponentProps<typeof FeedbackQrView> };

export async function loadScreenView(
  view: ScreenView,
  now: EventNow,
  settings: ScreenSettings,
): Promise<ScreenPayload> {
  const config = getEventConfig();
  const data = getData();

  switch (view) {
    case 'welcome':
      return {
        view,
        props: {
          name: config.event.name,
          tagline: config.event.tagline,
          dates: eventDates(config),
          venue: config.event.venue,
          portalUrl: passLink(config.event.portalUrl),
          logoPath: logoFor(config.branding, resolveTheme(config.branding, 'bigScreen')),
          accessCode: eventPass(),
        },
      };

    case 'now-next': {
      const agenda = buildAgenda(config);
      const nn = findNowAndNext(agenda, now);
      const first = nn.live[0];
      return {
        view,
        props: {
          live: nn.live.slice(0, 3).map(toScreenSession),
          minutesLeft: first ? minutesLeftInSession(first, now) : null,
          next: nn.next ? toScreenSession(nn.next) : null,
          minutesUntilNext: nn.minutesUntilNext,
          nextIsLaterDay: nn.next !== null && nn.next.date !== now.date,
          nextDayLabel: nn.next
            ? `${nn.next.dayLabel}, ${formatShortDate(nn.next.date, config.event.timezone)}`
            : '',
          afterEventEnds: nn.afterEventEnds,
        },
      };
    }

    case 'arrivals': {
      const day = resolveCheckInDay(config.days, now);
      const [people, checkIns] = await Promise.all([
        data.attendees.list(),
        day ? data.checkIns.listByDay(day.id) : Promise.resolve([]),
      ]);
      const count = guestCount(
        people,
        checkIns.map((c) => c.attendeeId),
      );
      const rate = arrivalRate(count.arrived, count.expected);
      const recent = [...checkIns].sort((a, b) => (a.at < b.at ? 1 : -1));
      // features.arrivalWall off means the counter only, whatever the MC picks.
      const hideNames = settings.hideNames || !config.features.arrivalWall;
      return {
        view,
        props: {
          arrived: rate.arrived,
          expected: rate.expected,
          percent: rate.percent,
          dayLabel: day?.label ?? 'today',
          cards: arrivalCards(recent, hideNames, 20).map((c) => ({
            ...c,
            department: shortDepartment(config, c.department),
          })),
          hideNames,
        },
      };
    }

    case 'countdown': {
      const [enabled, targetAt, label] = await Promise.all([
        data.settings.get(SURPRISE_KEYS.enabled),
        data.settings.get(SURPRISE_KEYS.targetAt),
        data.settings.get(SURPRISE_KEYS.label),
      ]);
      const surprise = resolveSurprise(config, { enabled, targetAt, label });
      const instant = surprise.enabled ? surpriseInstant(surprise, config.event.timezone) : null;
      return {
        view,
        props: { label: surprise.label, targetMs: instant ? instant.getTime() : null },
      };
    }

    case 'lucky-draw': {
      // Switched off in config: fall back rather than show an empty view.
      if (!config.features.luckyDraw) return loadScreenView('welcome', now, settings);

      const day = resolveCheckInDay(config.days, now);
      const [winners, checkIns, people, stored] = await Promise.all([
        data.luckyDraw.list(),
        day ? data.checkIns.listByDay(day.id) : Promise.resolve([]),
        data.attendees.list(),
        data.settings.get(LUCKY_KEYS.excluded),
      ]);
      const latest = groupDraws(winners).at(-1);
      const excluded = resolveExclusions(stored, people);
      const wonIds = new Set(winners.map((w) => w.attendeeId));

      // Names to spin through: whoever could have been drawn, shuffled, plus
      // the winners, so the spin feels like the real hat.
      const hat = checkIns.map((c) => c.attendee).filter((a) => !excluded.has(a.id));
      const spinNames = hat
        .map((a) => ({ a, k: Math.random() }))
        .sort((x, y) => x.k - y.k)
        .slice(0, 60)
        .map(({ a }) => a.name);

      return {
        view,
        props: {
          latest: latest
            ? {
                drawId: latest.drawId,
                prize: latest.prize,
                drawnAtMs: new Date(latest.drawnAt).getTime(),
                winners: latest.winners.map((w) => ({
                  key: w.id,
                  name: w.attendee.name,
                  department: shortDepartment(config, w.attendee.department),
                })),
              }
            : null,
          spinNames,
          inHat: hat.filter((a) => !wonIds.has(a.id)).length,
        },
      };
    }

    case 'name-picker': {
      const [raw, people] = await Promise.all([
        data.settings.get(PICKER_KEY),
        data.attendees.list(),
      ]);
      const latest = parsePickerState(raw).latest;
      const spinNames = people
        .filter((p) => !p.isSecretariat)
        .map((a) => ({ a, k: Math.random() }))
        .sort((x, y) => x.k - y.k)
        .slice(0, 60)
        .map(({ a }) => a.name);
      return {
        view,
        props: {
          latest: latest
            ? {
                id: latest.id,
                title: latest.title,
                fun: latest.fun !== false,
                atMs: new Date(latest.at).getTime(),
                people: latest.people.map((p) => ({
                  key: p.id,
                  name: p.name,
                  department: p.department,
                })),
              }
            : null,
          spinNames,
        },
      };
    }

    case 'photos': {
      if (!config.features.photoWall) return loadScreenView('welcome', now, settings);
      const [approved, layoutSetting] = await Promise.all([
        data.photos.list('approved'),
        data.settings.get(PHOTO_KEYS.layout),
      ]);
      const layout = resolvePhotoLayout(layoutSetting);
      return {
        view,
        props: {
          layout,
          slides: approved
            .slice(0, LAYOUT_COUNT[layout])
            .map((p) => ({ id: p.id, caption: p.caption, width: p.width, height: p.height })),
          shareUrl: passLink(`${config.event.portalUrl.replace(/\/$/, '')}/photos`),
        },
      };
    }

    case 'qa': {
      if (!config.features.qa) return loadScreenView('welcome', now, settings);
      const agenda = buildAgenda(config);
      const qaSessions = agenda.sessions.filter((s) => s.qaEnabled);
      // The session the moderator chose, else the one running now.
      const chosen = await data.settings.get(QA_KEYS.screenSession);
      const liveNow = findNowAndNext(agenda, now).live;
      const session =
        qaSessions.find((s) => s.id === chosen) ??
        qaSessions.find((s) => liveNow.some((l) => l.id === s.id)) ??
        qaSessions[0];
      const base = config.event.portalUrl.replace(/\/$/, '');
      const list = session ? screenQuestions(await data.questions.listBySession(session.id)) : [];
      return {
        view,
        props: {
          sessionTitle: session?.title ?? '',
          askUrl: passLink(session ? `${base}/qa/${session.id}` : base),
          questions: list.map((q) => ({
            id: q.id,
            text: q.text,
            name: q.name,
            votes: q.votes,
            pinned: q.pinned,
          })),
        },
      };
    }

    case 'poll': {
      if (!config.features.polls) return loadScreenView('welcome', now, settings);
      const polls = await data.polls.list();
      const poll =
        polls.find((p) => p.status === 'open') ??
        [...polls].reverse().find((p) => p.status === 'closed' && p.revealed) ??
        null;
      const votes = poll ? await data.polls.votes(poll.id) : [];
      return {
        view,
        props: {
          poll: poll
            ? {
                question: poll.question,
                kind: poll.kind,
                open: poll.status === 'open',
                revealed: poll.revealed,
                results: tallyPoll(poll, votes),
              }
            : null,
          voteUrl: passLink(`${config.event.portalUrl.replace(/\/$/, '')}/poll`),
        },
      };
    }

    case 'comments': {
      if (!config.features.comments) return loadScreenView('welcome', now, settings);
      const agenda = buildAgenda(config);
      // The talk the secretariat chose, else the one on now, else the next.
      const chosen = await data.settings.get(COMMENT_KEYS.screenSession);
      const live = findNowAndNext(agenda, now);
      const session =
        agenda.byId.get(chosen ?? '') ?? live.live[0] ?? live.next ?? agenda.sessions[0];
      const list = session
        ? screenComments(await data.comments.listBySession(session.id)).slice(0, SCREEN_COMMENTS)
        : [];
      return {
        view,
        props: {
          sessionTitle: session?.title ?? '',
          layout: resolveCommentLayout(await data.settings.get(COMMENT_KEYS.screenLayout)),
          comments: list.map((c) => ({
            id: c.id,
            text: c.text,
            name: settings.hideNames ? '' : c.name,
            likes: c.likes,
          })),
          commentUrl: passLink(
            `${config.event.portalUrl.replace(/\/$/, '')}/session/${session?.id ?? ''}`,
          ),
        },
      };
    }

    case 'leaderboard': {
      if (!config.features.leaderboard) return loadScreenView('welcome', now, settings);
      const board = await loadScoreboard({ shared: true });
      const name = (full: string) => (settings.hideNames ? shortName(full) : full);
      return {
        view,
        props: {
          people: board.people
            // Ten fit a 1080p projector at a size the back row can read.
            .slice(0, 10)
            .map((row) => ({
              id: row.attendeeId,
              rank: row.rank,
              name: name(row.name),
              department: shortDepartment(config, row.department),
              points: row.points,
            })),
          joinUrl: passLink(`${config.event.portalUrl.replace(/\/$/, '')}/me`),
        },
      };
    }

    case 'feedback': {
      if (!config.features.feedback) return loadScreenView('welcome', now, settings);
      const agenda = buildAgenda(config);
      const target = (await data.settings.get(SCREEN_KEYS.feedbackTarget)) ?? 'auto';
      const forms = agenda.sessions.filter((s) => s.feedbackEnabled && !s.hidden);
      let session: (typeof forms)[number] | null = null;
      if (target !== 'event') {
        const chosen = forms.find((s) => s.id === target);
        const nn = findNowAndNext(agenda, now);
        // The one on now with a form, else the last one that finished before now.
        const finished = forms
          .filter((s) => sessionStatus(s, now) === 'past')
          .sort((a, b) =>
            a.date === b.date ? b.endMinutes - a.endMinutes : a.date < b.date ? 1 : -1,
          )[0];
        session = chosen ?? nn.live.find((s) => s.feedbackEnabled) ?? finished ?? null;
      }
      const base = config.event.portalUrl.replace(/\/$/, '');
      return {
        view,
        props: {
          whole: session === null,
          title: session ? session.title : config.event.name,
          context: session
            ? `${session.dayLabel}, ${formatClock(session.start)} to ${formatClock(session.end)}`
            : 'Your feedback on the whole summit',
          url: passLink(`${base}/feedback/${session ? session.id : 'event'}`),
        },
      };
    }

    case 'podium': {
      if (!config.features.leaderboard) return loadScreenView('welcome', now, settings);
      const data = getData();
      const [board, sizeRaw, stepRaw] = await Promise.all([
        loadScoreboard({ shared: true }),
        data.settings.get(SCREEN_KEYS.podiumSize),
        data.settings.get(SCREEN_KEYS.podiumStep),
      ]);
      const size = parsePodiumSize(sizeRaw);
      const groups = podiumGroups(board.people, size);
      return {
        view,
        props: {
          size,
          calm: settings.calm,
          revealed: clampPodiumStep(Number(stepRaw ?? 0), groups.length),
          places: groups.map((g) => ({
            rank: g.rank,
            points: g.points,
            people: g.people.map((p) => ({
              id: p.attendeeId,
              name: settings.hideNames ? shortName(p.name) : p.name,
              department: shortDepartment(config, p.department),
            })),
          })),
        },
      };
    }

    default: {
      const unreachable: never = view;
      throw new Error(`Unknown screen view ${String(unreachable)}`);
    }
  }
}
