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
  async headers() {
    return [
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
