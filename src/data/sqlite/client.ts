/**
 * The Prisma client for the local SQLite store.
 *
 * This is the only file in the project allowed to import Prisma (see the
 * lint rule in eslint.config.mjs and hard rule 4 in the brief). Everything
 * else goes through the DataAdapter interface.
 */
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { eventPortalPrisma?: PrismaClient };

export function getPrismaClient(): PrismaClient {
  if (globalForPrisma.eventPortalPrisma) return globalForPrisma.eventPortalPrisma;

  const url = process.env.DATABASE_URL ?? 'file:./prisma/dev.db';
  const adapter = new PrismaBetterSqlite3({ url });

  // Query logging is deliberately off: queries carry attendee names and the
  // brief says no personal data in logs. Warnings and errors only.
  const client = new PrismaClient({ adapter, log: ['warn', 'error'] });

  // Reused across hot reloads in development, so dev does not open a new
  // connection on every file save.
  globalForPrisma.eventPortalPrisma = client;
  return client;
}
