/**
 * The local store: SQLite through Prisma. Used for development, the tests
 * and the static preview. The repositories themselves live in
 * src/data/prisma/store.ts and are shared with the hosted Postgres store.
 */
import type { DataAdapter } from '../adapter';
import { createPrismaAdapter } from '../prisma/store';

import { getPrismaClient } from './client';

export function createSqliteAdapter(): DataAdapter {
  return createPrismaAdapter(getPrismaClient(), {
    name: 'sqlite',
    label: 'SQLite',
    notReadyHint: 'Try "npm run db:push".',
    caseInsensitiveSearch: false,
  });
}
