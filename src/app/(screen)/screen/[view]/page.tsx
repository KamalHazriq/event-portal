import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { renderScreen } from '@/modules/big-screen/render';
import { isScreenView, SCREEN_VIEW_INFO } from '@/modules/big-screen/logic';

export const dynamic = 'force-dynamic';

type Params = Promise<{ view: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { view } = await params;
  return {
    title: isScreenView(view) ? `Big screen: ${SCREEN_VIEW_INFO[view].title}` : 'Big screen',
  };
}

/**
 * One view, always, whatever the MC picks. Useful for a second screen, such
 * as a monitor at the registration desk showing arrivals all morning.
 */
export default async function FixedScreenPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { view } = await params;
  if (!isScreenView(view)) notFound();
  const query = await searchParams;
  return renderScreen({ view, returnTo: `/screen/${view}`, nowParam: query.now });
}
