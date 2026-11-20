import { appManifest } from '@/lib/app-manifest';

export const dynamic = 'force-dynamic';

export function GET() {
  return appManifest({
    path: '/admin',
    title: 'Secretariat',
    short: 'Secretariat',
    about: 'The secretariat desk',
    display: 'standalone',
  });
}
