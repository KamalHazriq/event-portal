/**
 * The Prisma client for the hosted store: Neon Postgres.
 *
 * It is generated from prisma/postgres/schema.prisma, a copy of the main
 * schema (see schema-text.ts), so its query API is the same as the SQLite
 * client's and the shared store code works on both.
 *
 * Connections, following Neon's guidance:
 * - App queries use DATABASE_URL, the pooled (PgBouncer) connection.
 * - Creating the tables uses DATABASE_URL_UNPOOLED, the direct one, since
 *   schema changes should not go through the pooler. It falls back to
 *   DATABASE_URL when only one is set. `neon deploy` / `neon env pull`
 *   write both.
 *
 * Driver, set with PG_DRIVER:
 * - "pg" (default): node-postgres with a pool. Neon's recommendation for a
 *   long-running Node server, which is what Firebase App Hosting runs.
 * - "neon-websocket": Neon's serverless driver over a WebSocket on port 443.
 *   For places that cannot open Postgres's own port 5432, such as an
 *   HTTPS-only sandbox or an edge runtime.
 *
 * The tables create themselves: before the first query, the "create if not
 * exists" script in schema-sql.ts runs once. Nobody has to run a migration
 * against the hosted database by hand.
 */
import { neonConfig, Pool as NeonPool } from '@neondatabase/serverless';
import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaPg } from '@prisma/adapter-pg';
import type { PrismaClient } from '@prisma/client';
import { Client as PgClient, Pool as PgPool } from 'pg';

import { PrismaClient as PostgresPrismaClient } from '@/generated/postgres';

import { POSTGRES_SCHEMA_SQL } from './schema-sql';

/** Any number, the same in every instance, so only one creates the tables. */
const SCHEMA_LOCK_ID = 20261214;

export type PostgresDriver = 'pg' | 'neon-websocket';

type Cached = { client: PrismaClient; driver: PostgresDriver };
const globalForPostgres = globalThis as unknown as { eventPortalPostgres?: Cached };

function poolSize(): number {
  const raw = Number(process.env.PG_POOL_MAX ?? '');
  return Number.isInteger(raw) && raw > 0 ? raw : 5;
}

export function postgresDriver(): PostgresDriver {
  const raw = (process.env.PG_DRIVER ?? 'pg').trim().toLowerCase();
  if (raw === 'pg' || raw === '') return 'pg';
  if (raw === 'neon-websocket') return 'neon-websocket';
  throw new Error(`PG_DRIVER must be "pg" or "neon-websocket". Got "${raw}".`);
}

function connectionStrings(): { app: string; setup: string } {
  const app = process.env.DATABASE_URL ?? '';
  if (!/^postgres(ql)?:\/\//.test(app)) {
    throw new Error(
      'DATA_ADAPTER is "postgres" but DATABASE_URL is not a postgres:// connection string.',
    );
  }
  const direct = process.env.DATABASE_URL_UNPOOLED ?? '';
  return { app, setup: /^postgres(ql)?:\/\//.test(direct) ? direct : app };
}

/** The whole create script in one transaction, under a lock, on the direct connection. */
const bootstrapSql = () =>
  `BEGIN;\nSELECT pg_advisory_xact_lock(${SCHEMA_LOCK_ID});\n${POSTGRES_SCHEMA_SQL}\nCOMMIT;`;

async function createTables(driver: PostgresDriver, setupUrl: string): Promise<void> {
  if (driver === 'neon-websocket') {
    const pool = new NeonPool({ connectionString: setupUrl, max: 1 });
    try {
      await pool.query(bootstrapSql());
    } finally {
      await pool.end();
    }
    return;
  }
  const client = new PgClient({ connectionString: setupUrl });
  await client.connect();
  try {
    await client.query(bootstrapSql());
  } finally {
    await client.end();
  }
}

export function getPostgresClient(): PrismaClient {
  if (globalForPostgres.eventPortalPostgres) return globalForPostgres.eventPortalPostgres.client;

  const driver = postgresDriver();
  const urls = connectionStrings();

  if (driver === 'neon-websocket' && typeof WebSocket !== 'undefined') {
    // Node 22 and newer have WebSocket built in, so no extra package.
    neonConfig.webSocketConstructor = WebSocket;
  }

  // One attempt at a time. A failure is forgotten, so the next request
  // tries again rather than the server staying broken until a restart.
  let ready: Promise<void> | null = null;
  const ensureSchema = (): Promise<void> => {
    ready ??= createTables(driver, urls.setup).catch((error: unknown) => {
      ready = null;
      throw error;
    });
    return ready;
  };

  const adapter =
    driver === 'neon-websocket'
      ? new PrismaNeon({ connectionString: urls.app, max: poolSize() })
      : new PrismaPg(new PgPool({ connectionString: urls.app, max: poolSize() }));

  // Query logging is off on purpose: queries carry attendee names.
  const base = new PostgresPrismaClient({ adapter, log: ['warn', 'error'] });
  const client = base.$extends({
    query: {
      async $allOperations({ args, query }) {
        await ensureSchema();
        return query(args);
      },
    },
  }) as unknown as PrismaClient;

  globalForPostgres.eventPortalPostgres = { client, driver };
  return client;
}

/** For the dashboard's storage card. */
export function postgresLabel(): string {
  return postgresDriver() === 'neon-websocket' ? 'Postgres (Neon WebSocket)' : 'Postgres';
}
