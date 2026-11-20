import { appManifest } from '@/lib/app-manifest';

export const dynamic = 'force-dynamic';

export function GET() {
  return appManifest({
    path: '/screen',
    title: 'Big screen',
    short: 'Screen',
    about: 'The projector screen',
    display: 'fullscreen',
  });
}
