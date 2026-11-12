/**
 * The hosted store: Postgres (Neon) through Prisma. Same repositories as
 * SQLite, see src/data/prisma/store.ts.
 */
import type { DataAdapter } from '../adapter';
import { createPrismaAdapter } from '../prisma/store';

import { getPostgresClient } from './client';

export function createPostgresAdapter(): DataAdapter {
  return createPrismaAdapter(getPostgresClient(), {
    name: 'postgres',
    label: 'Postgres',
    notReadyHint: 'Check DATABASE_URL and that the database is awake.',
    caseInsensitiveSearch: true,
  });
}
