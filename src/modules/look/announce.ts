/**
 * The one line across the top of the Ruled style: what matters right now.
 * Before the event, when and where registration opens; during it, what is
 * on now or next; after it, thanks. Pure, see announce.test.ts.
 */
import type { NowAndNext } from '@/modules/schedule/logic';

export type Announcement = { text: string; strong: string; link: { href: string; label: string } };

type Formatters = {
  clock: (time: string) => string;
  shortDate: (isoDate: string) => string;
};

export function announcement(
  nowAndNext: NowAndNext,
  event: { name: string; startDate: string; endDate: string },
  today: string,
  f: Formatters,
): Announcement {
  if (today > event.endDate) {
    return {
      strong: `Thank you for joining ${event.name}.`,
      text: 'Slides, photos and take aways stay here.',
      link: { href: '/agenda', label: 'Look back at the agenda' },
    };
  }

  const live = nowAndNext.live[0];
  if (nowAndNext.today && live) {
    return {
      strong: `${nowAndNext.today.label}, on now:`,
      text: `${live.title}${live.room ? `, ${live.room}` : ''}.`,
      link: { href: `/session/${live.id}`, label: 'Open the session' },
    };
  }

  const next = nowAndNext.next;
  if (nowAndNext.today && next && next.date === today) {
    return {
      strong: `${nowAndNext.today.label}, next:`,
      text: `${next.title} at ${f.clock(next.start)}${next.room ? `, ${next.room}` : ''}.`,
      link: { href: `/session/${next.id}`, label: 'Open the session' },
    };
  }

  const first = nowAndNext.focusDay?.sessions[0];
  return {
    strong: `${nowAndNext.focusDay?.label ?? 'Day 1'}, ${f.shortDate(nowAndNext.focusDay?.date ?? event.startDate)}.`,
    text: first
      ? `${first.title} from ${f.clock(first.start)}${first.room ? ` in the ${first.room}` : ''}.`
      : `${event.name} begins.`,
    link: { href: '/agenda', label: 'See the agenda' },
  };
}
