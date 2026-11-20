import { appManifest } from '@/lib/app-manifest';

export const dynamic = 'force-dynamic';

export function GET() {
  return appManifest({
    path: '/kiosk',
    title: 'Check in kiosk',
    short: 'Kiosk',
    about: 'The self check in kiosk',
    display: 'fullscreen',
  });
}
