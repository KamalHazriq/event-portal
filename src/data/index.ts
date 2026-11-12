/**
 * How the rest of the app gets at the data.
 *
 *   import { getData } from '@/data';
 *   const data = getData();
 *   const headcount = await data.checkIns.headcount('day-1');
 *
 * Which store answers is decided by DATA_ADAPTER: "sqlite" for local work
 * and tests, "postgres" when hosted (Firebase App Hosting with Neon). A new
 * store is a new case in the switch below. No page or component changes.
 */
import { DATA_ADAPTERS, type DataAdapter, type DataAdapterName } from './adapter';
import { createPostgresAdapter } from './postgres';
import { createSqliteAdapter } from './sqlite';

export type { DataAdapter } from './adapter';
export type * from './types';

let instance: DataAdapter | null = null;

function resolveAdapterName(): DataAdapterName {
  const raw = (process.env.DATA_ADAPTER ?? 'sqlite').trim().toLowerCase();
  if ((DATA_ADAPTERS as readonly string[]).includes(raw)) return raw as DataAdapterName;
  throw new Error(
    `DATA_ADAPTER must be one of: ${DATA_ADAPTERS.join(', ')}. Got "${raw}". Check .env.local.`,
  );
}

export function getData(): DataAdapter {
  if (instance) return instance;

  const name = resolveAdapterName();
  switch (name) {
    case 'sqlite':
      instance = createSqliteAdapter();
      return instance;
    case 'postgres':
      instance = createPostgresAdapter();
      return instance;
    default: {
      // Makes TypeScript complain here if a new adapter name is added to
      // DATA_ADAPTERS without being wired up.
      const unreachable: never = name;
      throw new Error(`No adapter is wired up for "${String(unreachable)}".`);
    }
  }
}

/** Only for tests, so one test does not inherit another test's adapter. */
export function resetDataForTests(): void {
  instance = null;
}
