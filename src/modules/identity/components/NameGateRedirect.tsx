'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

import { asksName } from '../logic';

/**
 * Sends a device that has not said who it is to the Welcome page first, and
 * covers the page meanwhile so nothing flashes behind it.
 */
export function NameGateRedirect() {
  const pathname = usePathname();
  const search = useSearchParams();
  const router = useRouter();
  const asks = asksName(pathname);
  const target = `/welcome?next=${encodeURIComponent(pathname + (search.size ? `?${search}` : ''))}`;

  useEffect(() => {
    if (asks) router.replace(target);
  }, [asks, router, target]);

  if (!asks) return null;
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-canvas p-6 text-center">
      <p className="text-ink-soft">
        One moment…{' '}
        <Link href={target} className="font-semibold text-primary">
          Tell us who you are
        </Link>
      </p>
    </div>
  );
}
