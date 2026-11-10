/**
 * The admin pages that are previews with dummy data, and which module will
 * replace each one. The dashboard and the previews hub both read this, so a
 * page drops off both lists by deleting one line once it is built for real.
 */
export const PREVIEW_PAGES = [
  {
    href: '/admin/photos',
    title: 'Photo wall',
    module: 'Extra, photo wall',
    description: 'Approve photos before they reach the slideshow.',
  },
  {
    href: '/admin/committees',
    title: 'Committee summary',
    module: 'Extra, SVC, ATC and OTC summary',
    description: 'Upload the committee Excel and see a read only summary.',
  },
  {
    href: '/admin/qa',
    title: 'Q&A queue',
    module: 'Module 2, backup Q&A if Slido is down',
    description: 'Approve, pin, answer or hide questions before they reach the screen.',
  },
  {
    href: '/admin/polls',
    title: 'Polls',
    module: 'Module 3, backup polls if Slido is down',
    description: 'Open, close and reveal polls, including word clouds.',
  },
  {
    href: '/admin/admins',
    title: 'Admins',
    module: 'Module 6, who else is signed in',
    description: 'The 2 to 3 desks signed in right now, and what they last did.',
  },
] as const;
