/**
 * The hosted store: Postgres (Neon) through Prisma. Same repositories as
 * SQLite, see src/data/prisma/store.ts.
 */
import type { DataAdapter } from '../adapter';
import { objectStoreFromEnv } from '../object-storage';
import { createPrismaAdapter } from '../prisma/store';

import { getPostgresClient, postgresLabel } from './client';

export function createPostgresAdapter(): DataAdapter {
  // Photos go to the branch's bucket when Neon Object Storage is set up, so
  // the rows and the files that belong to them live on the same branch.
  const objects = objectStoreFromEnv();
  return createPrismaAdapter(getPostgresClient(), {
    name: 'postgres',
    label: objects ? `${postgresLabel()}, photos in bucket "${objects.bucket}"` : postgresLabel(),
    objects,
    notReadyHint: 'Check DATABASE_URL and that the database is awake.',
    caseInsensitiveSearch: true,
  });
}
