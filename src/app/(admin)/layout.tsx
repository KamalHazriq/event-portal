import { hiddenAdminPages } from '@/components/admin-pages';
import type { Metadata } from 'next';

import { AdminHeader, AdminSidebar } from '@/components/AdminHeader';
import { getAdminSession } from '@/lib/admin-guard';
import { getEventConfig } from '@/lib/config';
import { markFor, resolveTheme } from '@/lib/theme';

/** The secretariat installs as its own app, opening at /admin. */
export const metadata: Metadata = {
  manifest: '/admin/app.webmanifest',
  // The D with an S badge: the secretariat app and tab look different.
  icons: {
    icon: [
      { url: '/branding/d-icon-admin-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/branding/d-icon-admin-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [{ url: '/branding/d-icon-admin-apple-180.png' }],
  },
};

/**
 * The shell for the secretariat.
 *
 * Phones get a header with a swipeable row of tabs, for use standing at the
 * desk with one hand. From laptop width it becomes an app: a sidebar with
 * the pages grouped by when they are used, and the page filling the rest of
 * the screen, for a laptop with the headcount open all day.
 *
 * This layout does not gate access. Each page calls requireAdmin itself, so
 * that moving a page can never quietly remove its protection.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const config = getEventConfig();
  const session = await getAdminSession();
  const mark = markFor(config.branding, resolveTheme(config.branding, 'portal'));
  const operator = session?.operator ?? null;

  return (
    <div
      className={[
        'min-h-dvh w-full',
        operator ? 'lg:grid lg:grid-cols-[16.5rem_minmax(0,1fr)] print:block' : '',
      ].join(' ')}
    >
      {operator ? (
        <AdminSidebar
          shortName={config.event.shortName}
          operator={operator}
          mark={mark}
          hidden={hiddenAdminPages(config.features)}
        />
      ) : null}

      <div className="flex min-h-dvh min-w-0 flex-col">
        <AdminHeader
          shortName={config.event.shortName}
          operator={operator}
          mark={mark}
          hidden={hiddenAdminPages(config.features)}
        />
        <main
          id="main"
          className={[
            'page-enter w-full flex-1 px-4 pb-16 pt-5 sm:px-6 lg:px-10 lg:pt-10',
            operator ? 'mx-auto max-w-[96rem]' : 'mx-auto max-w-5xl',
          ].join(' ')}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
