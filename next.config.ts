import type { NextConfig } from 'next';

/**
 * Kept deliberately small. Hard rule 6 in the project brief: light pages,
 * no heavy client libraries, first load under about 300 KB of JavaScript.
 */
const projectRoot = import.meta.dirname;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  /**
   * Pin the project root. Without this, Next walks up the folder tree looking
   * for a lock file and can decide the user's home directory is the workspace
   * root, which would drag unrelated files into the build.
   */
  turbopack: { root: projectRoot },
  outputFileTracingRoot: projectRoot,

  /**
   * The event config and the attendee CSV are read from disk at runtime, so
   * they must be copied into a standalone build. src/lib/config.ts explains
   * why the path itself is not statically analysable.
   */
  /**
   * The logos and icons change rarely, so the browser may keep them for a day
   * and refresh them quietly in the background after that.
   */
  /** The secretariat addresses now match the menu names. Old links still work. */
  async redirects() {
    return [
      { source: '/admin/announcements', destination: '/admin/announce', permanent: false },
      { source: '/admin/event', destination: '/admin/event-info', permanent: false },
      { source: '/admin/checklist', destination: '/admin/test-plan', permanent: false },
    ];
  },

  async headers() {
    return [
      {
        // Every page: nobody can frame the portal, the browser keeps to the
        // type it is told, forms only post back here, and only this site may
        // use the camera.
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(self), microphone=(), geolocation=(), payment=(), usb=()',
          },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000' },
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
          },
        ],
      },
      {
        source: '/branding/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, stale-while-revalidate=604800',
          },
        ],
      },
    ];
  },

  outputFileTracingIncludes: {
    '/**': ['./config/**'],
  },
};

export default nextConfig;
