import { appManifest } from '@/lib/app-manifest';

export const dynamic = 'force-dynamic';

export function GET() {
  return appManifest({
    path: '/admin',
    title: 'Secretariat',
    short: 'Secretariat',
    about: 'The secretariat desk',
    display: 'standalone',
    // The D with an S badge, so it is not mixed up with the attendee app.
    icon: 'd-icon-admin',
  });
}
