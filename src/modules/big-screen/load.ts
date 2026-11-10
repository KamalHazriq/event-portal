/**
 * Gathers what one projector view needs. Server only: it reads the database.
 *
 * Shared by /screen (which follows the admin's choice) and /screen/<view>
 * (which always shows one view), so both always agree.
 */
import { getData } from '@/data';
import { getEventConfig } from '@/lib/config';
import type { EventConfig } from '@/lib/event-schema';
import { formatClock, formatShortDate, type EventNow } from '@/lib/time';
import {
  minutesLeftInSession,
  resolveSurprise,
  SURPRISE_KEYS,
  surpriseInstant,
} from '@/modules/admin/logic';
import { arrivalRate, resolveCheckInDay } from '@/modules/check-in/logic';
import { groupDraws, LUCKY_KEYS, resolveExclusions } from '@/modules/lucky-draw/logic';
import { buildAgenda, findNowAndNext, type ResolvedSession } from '@/modules/schedule/logic';

import {
  arrivalCards,
  guestCount,
  SCREEN_KEYS,
  resolveScreenSettings,
  type ScreenSettings,
  type ScreenView,
} from './logic';
import type {
  ArrivalsView,
  CountdownView,
  LuckyDrawView,
  NowNextView,
  ScreenSession,
  WelcomeView,
} from './components/ScreenViews';
import type { ComponentProps } from 'react';

export async function readScreenSettings(): Promise<ScreenSettings> {
  const data = getData();
  const [view, hideNames] = await Promise.all([
    data.settings.get(SCREEN_KEYS.view),
    data.settings.get(SCREEN_KEYS.hideNames),
  ]);
  return resolveScreenSettings({ view, hideNames });
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
  | { view: 'lucky-draw'; props: ComponentProps<typeof LuckyDrawView> };

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
          portalUrl: config.event.portalUrl,
          logoPath: config.branding.logoPath ?? null,
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
          cards: arrivalCards(recent, hideNames),
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
      const hat = checkIns
        .map((c) => c.attendee)
        .filter((a) => !excluded.has(a.id) && !a.isSecretariat);
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
                  department: w.attendee.department,
                })),
              }
            : null,
          spinNames,
          inHat: hat.filter((a) => !wonIds.has(a.id)).length,
        },
      };
    }

    default: {
      const unreachable: never = view;
      throw new Error(`Unknown screen view ${String(unreachable)}`);
    }
  }
}
