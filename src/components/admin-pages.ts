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

export const ADMIN_GROUPS: { name: string; pages: AdminPage[] }[] = [
  {
    name: 'On the day',
    pages: [
      {
        href: '/admin/live',
        label: 'Live',
        title: 'Live control',
        description: 'What is on now, minutes left, what is next, the room and the countdown.',
        icon: 'live',
      },
      {
        href: '/admin/desk',
        label: 'Desk',
        title: 'Registration desk',
        description: 'Scan name tags or search by name to check people in.',
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
        href: '/admin/big-screen',
        label: 'Big screen',
        title: 'Big screen',
        description: 'Choose what the ballroom projector shows, from your phone.',
        icon: 'monitor',
      },
    ],
  },
  {
    name: 'Engage the room',
    pages: [
      {
        href: '/admin/lucky-draw',
        label: 'Lucky draw',
        title: 'Lucky draw',
        description: 'Draw winners from whoever has checked in. Nobody wins twice.',
        icon: 'gift',
      },
      {
        href: '/admin/photos',
        label: 'Photos',
        title: 'Photo wall',
        description: 'Approve photos before they reach the big screen slideshow.',
        icon: 'image',
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
    ],
  },
  {
    name: 'After the event',
    pages: [
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
    ],
  },
  {
    name: 'Set up',
    pages: [
      {
        href: '/admin/name-tags',
        label: 'Name tags',
        title: 'Name tags',
        description: 'Print tags with a personal QR on the front and the portal QR on the back.',
        icon: 'tag',
      },
      {
        href: '/admin/qr-assets',
        label: 'QR assets',
        title: 'QR assets',
        description: 'Table tents to print and a portal QR to drop into a slide.',
        icon: 'qr',
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
