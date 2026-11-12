/**
 * The Prisma client for the hosted store: Postgres, such as a free Neon
 * database, reached from Firebase App Hosting.
 *
 * It is generated from prisma/postgres/schema.prisma, a copy of the main
 * schema (see schema-text.ts), so its query API is the same as the SQLite
 * client's and the shared store code works on both.
 *
 * The tables create themselves: before the first query, the "create if not
 * exists" script in schema-sql.ts runs once. Nobody has to run a migration
 * against the hosted database by hand.
 */
import { PrismaPg } from '@prisma/adapter-pg';
import type { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';

import { PrismaClient as PostgresPrismaClient } from '@/generated/postgres';

import { POSTGRES_SCHEMA_SQL } from './schema-sql';

/** Any number, the same in every instance, so only one creates the tables. */
const SCHEMA_LOCK_ID = 20261214;

type Cached = { client: PrismaClient; pool: Pool };
const globalForPostgres = globalThis as unknown as { eventPortalPostgres?: Cached };

function poolSize(): number {
  const raw = Number(process.env.PG_POOL_MAX ?? '');
  return Number.isInteger(raw) && raw > 0 ? raw : 5;
}

export function getPostgresClient(): PrismaClient {
  if (globalForPostgres.eventPortalPostgres) return globalForPostgres.eventPortalPostgres.client;

  const connectionString = process.env.DATABASE_URL ?? '';
  if (!/^postgres(ql)?:\/\//.test(connectionString)) {
    throw new Error(
      'DATA_ADAPTER is "postgres" but DATABASE_URL is not a postgres:// connection string.',
    );
  }

  const pool = new Pool({ connectionString, max: poolSize() });

  // One attempt at a time. A failure is forgotten, so the next request
  // tries again rather than the server staying broken until a restart.
  let ready: Promise<void> | null = null;
  const ensureSchema = (): Promise<void> => {
    ready ??= pool
      .query(
        `BEGIN;\nSELECT pg_advisory_xact_lock(${SCHEMA_LOCK_ID});\n${POSTGRES_SCHEMA_SQL}\nCOMMIT;`,
      )
      .then(() => undefined)
      .catch((error: unknown) => {
        ready = null;
        throw error;
      });
    return ready;
  };

  // Query logging is off on purpose: queries carry attendee names.
  const base = new PostgresPrismaClient({ adapter: new PrismaPg(pool), log: ['warn', 'error'] });
  const client = base.$extends({
    query: {
      async $allOperations({ args, query }) {
        await ensureSchema();
        return query(args);
      },
    },
  }) as unknown as PrismaClient;

  globalForPostgres.eventPortalPostgres = { client, pool };
  return client;
}
