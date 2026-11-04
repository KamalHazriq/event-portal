import { AdminHeader } from '@/components/AdminHeader';
import { getAdminSession } from '@/lib/admin-guard';
import { getEventConfig } from '@/lib/config';

/**
 * The shell for the secretariat.
 *
 * Wider than the attendee shell and with its own navigation, because this is
 * used standing at a desk with one hand, or on a laptop with the headcount
 * open all day.
 *
 * This layout does not gate access. Each page calls requireAdmin itself, so
 * that moving a page can never quietly remove its protection.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const config = getEventConfig();
  const session = await getAdminSession();

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col">
      <AdminHeader shortName={config.event.shortName} operator={session?.operator ?? null} />

      <main id="main" className="flex-1 px-4 pb-16 pt-4">
        {children}
      </main>
    </div>
  );
}
