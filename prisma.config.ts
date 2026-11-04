/**
 * Prisma CLI configuration (Prisma 7).
 *
 * Prisma 7 no longer reads the database URL from schema.prisma and no longer
 * loads .env by itself, so it is read here. Node's own loadEnvFile is used
 * rather than adding a dotenv dependency.
 */
import path from 'node:path';

import { defineConfig } from 'prisma/config';

// .env first, then .env.local so local settings win.
for (const file of ['.env', '.env.local']) {
  try {
    process.loadEnvFile(path.join(process.cwd(), file));
  } catch {
    // The file is optional. A fresh clone has no .env.local yet.
  }
}

export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  migrations: {
    path: path.join('prisma', 'migrations'),
    seed: 'tsx scripts/seed.ts',
  },
  datasource: {
    // Local development default. Override in .env.local.
    url: process.env.DATABASE_URL ?? 'file:./prisma/dev.db',
  },
});
