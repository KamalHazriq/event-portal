/**
 * The admin pages that are previews with dummy data, and which module will
 * replace each one. The dashboard and the previews hub both read this, so a
 * page drops off both lists by deleting one line once it is built for real.
 */
export const PREVIEW_PAGES = [
  {
    href: '/admin/admins',
    title: 'Admins',
    module: 'Module 6, who else is signed in',
    description: 'The 2 to 3 desks signed in right now, and what they last did.',
  },
] as const;
