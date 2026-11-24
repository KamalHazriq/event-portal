import type { IconName } from './icons';

/**
 * Every secretariat page, grouped by when it is used. The sidebar, the phone
 * tab row and the secretariat home all read this, so a page is added in one
 * place.
 */
export type AdminPage = {
  href: string;
  label: string;
  title: string;
  description: string;
  icon: IconName;
};

/**
 * A group of pages. A folded group sits under "More": pages used rarely or
 * only when something goes wrong (the Slido backups, reports, the log), so
 * the everyday menu stays short.
 */
export type AdminGroup = {
  name: string;
  /** The address of the group's own page, which lists all its pages: /admin/<slug>. */
  slug: string;
  folded?: boolean;
  pages: AdminPage[];
};

export const groupHref = (group: AdminGroup): string => `/admin/${group.slug}`;

export const ADMIN_GROUPS: AdminGroup[] = [
  {
    name: 'On the day',
    slug: 'on-the-day',
    pages: [
      {
        href: '/admin/desk',
        label: 'Desk',
        title: 'Registration desk',
        description:
          'Scan the business card in the TNB app, or search by name, to check people in.',
        icon: 'scan',
      },
      {
        href: '/admin/headcount',
        label: 'Headcount',
        title: 'Headcount',
        description: 'Who has arrived, by department, and who is still missing.',
        icon: 'users',
      },
      {
        href: '/admin/live',
        label: 'Live',
        title: 'Live control',
        description: 'What is on now, minutes left, what is next, the room and the countdown.',
        icon: 'live',
      },
      {
        href: '/admin/big-screen',
        label: 'Big screen',
        title: 'Big screen',
        description: 'Choose what the ballroom projector shows, from your phone.',
        icon: 'monitor',
      },
      {
        href: '/admin/runbook',
        label: 'Runbook',
        title: 'Event-day runbook',
        description: 'The morning checklist, who does what, and the plan for each day. Printable.',
        icon: 'book',
      },
    ],
  },
  {
    name: 'Engage the room',
    slug: 'engage-the-room',
    pages: [
      {
        href: '/admin/comments',
        label: 'Comments',
        title: 'Comments and reactions',
        description: 'Approve comments on each talk, and see the live reactions.',
        icon: 'message',
      },
      {
        href: '/admin/photos',
        label: 'Photos',
        title: 'Photo wall',
        description: 'Approve photos, or let them straight up, and choose the big screen layout.',
        icon: 'image',
      },
      {
        href: '/admin/announce',
        label: 'Announce',
        title: 'Announcements',
        description:
          'A message at the top of every phone, and a notification to phones with alerts on.',
        icon: 'megaphone',
      },
      {
        href: '/admin/lucky-draw',
        label: 'Lucky draw',
        title: 'Lucky draw',
        description: 'Draw winners from whoever has checked in. Nobody wins twice.',
        icon: 'gift',
      },
      {
        href: '/admin/name-picker',
        label: 'Name picker',
        title: 'Name picker',
        description:
          'Pick people at random to speak or answer, spinning on the big screen. Separate from the prizes.',
        icon: 'sparkle',
      },
      {
        href: '/admin/door-gifts',
        label: 'Door gifts',
        title: 'Door gifts',
        description:
          'Each person spins for one door gift when they first sign in. Stock, who got what, and changes.',
        icon: 'gift',
      },
    ],
  },
  {
    name: 'Set up',
    slug: 'set-up',
    pages: [
      {
        href: '/admin/agenda',
        label: 'Agenda',
        title: 'Agenda',
        description: 'Change a session or its time, room and speakers, hide one, or add one.',
        icon: 'calendar',
      },
      {
        href: '/admin/event-info',
        label: 'Event info',
        title: 'Event info',
        description:
          'Event name and venue, the Know before you go page, resource links, Slido and department short names.',
        icon: 'book',
      },
      {
        href: '/admin/attendees',
        label: 'Attendees',
        title: 'Attendees',
        description: 'Upload the participant list from Excel or CSV, and see who is on it.',
        icon: 'users',
      },
      {
        href: '/admin/test-plan',
        label: 'Test plan',
        title: 'Test plan',
        description:
          'Everything to check end to end, as an attendee and as the secretariat. Tick as you go.',
        icon: 'shield',
      },
      {
        href: '/admin/device-check',
        label: 'Device check',
        title: 'Device check',
        description:
          'Open on the real tablet, projector laptop and phones: camera, alerts, speed and clock.',
        icon: 'monitor',
      },
      {
        href: '/admin/name-tags',
        label: 'Name tags',
        title: 'Name tags',
        description: 'Print one sided name tags with the portal QR, ten to an A4 page.',
        icon: 'tag',
      },
      {
        href: '/admin/qr-assets',
        label: 'QR assets',
        title: 'QR assets',
        description: 'Table tents to print and a portal QR to drop into a slide.',
        icon: 'qr',
      },
    ],
  },
  {
    name: 'More',
    slug: 'more',
    folded: true,
    pages: [
      {
        href: '/admin/points',
        label: 'Points',
        title: 'Points',
        description: 'Where everyone’s points come from, person by person.',
        icon: 'star',
      },
      {
        href: '/admin/insights',
        label: 'Insights',
        title: 'Insights',
        description: 'What needs attention, peak arrival times, and the liveliest sessions.',
        icon: 'chart',
      },
      {
        href: '/admin/feedback',
        label: 'Feedback',
        title: 'Feedback',
        description: 'What people thought of each session, and who gives their name.',
        icon: 'star',
      },
      {
        href: '/admin/qa',
        label: 'Q&A',
        title: 'Q&A queue',
        description: 'The backup for Slido: approve, pin, answer or hide questions.',
        icon: 'message',
      },
      {
        href: '/admin/polls',
        label: 'Polls',
        title: 'Polls',
        description: 'The backup for Slido: open, close and reveal polls and word clouds.',
        icon: 'poll',
      },
      {
        href: '/admin/reports',
        label: 'Reports',
        title: 'Reports',
        description: 'The whole event in Excel, a summary to save as PDF, and the Slido import.',
        icon: 'chart',
      },
      {
        href: '/admin/committees',
        label: 'Committees',
        title: 'Committee summary',
        description: 'Upload a committee Excel and choose who can see its summary.',
        icon: 'folder',
      },
      {
        href: '/admin/admins',
        label: 'Admins',
        title: 'Admins',
        description: 'Which desks are signed in right now, and what each one did.',
        icon: 'shield',
      },
    ],
  },
];

export const ADMIN_PAGES: AdminPage[] = ADMIN_GROUPS.flatMap((g) => g.pages);

/** The pages in the everyday menu, without the folded "More" group. */
export const EVERYDAY_PAGES: AdminPage[] = ADMIN_GROUPS.filter((g) => !g.folded).flatMap(
  (g) => g.pages,
);

export function findGroup(slug: string): AdminGroup | undefined {
  return ADMIN_GROUPS.find((g) => g.slug === slug);
}

/** Pages of modules switched off in the event file: kept out of every menu. */
export function hiddenAdminPages(features: { committees: boolean; doorGift: boolean }): string[] {
  return [
    ...(features.committees ? [] : ['/admin/committees']),
    ...(features.doorGift ? [] : ['/admin/door-gifts']),
  ];
}
