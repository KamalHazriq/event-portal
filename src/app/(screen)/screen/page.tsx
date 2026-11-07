import type { Metadata } from 'next';

import { renderScreen } from '@/modules/big-screen/render';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Big screen' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * Open this on the projector laptop and leave it. It shows whatever view the
 * MC picks on /admin/big-screen, and follows a change within seconds.
 */
export default async function ScreenPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  return renderScreen({ view: null, returnTo: '/screen', nowParam: params.now });
}
