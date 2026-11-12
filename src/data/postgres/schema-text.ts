/**
 * Keeps the Postgres schema a copy of the SQLite one.
 *
 * prisma/schema.prisma is the only schema anyone edits. Prisma cannot point
 * one schema file at two kinds of database, so prisma/postgres/schema.prisma
 * is produced from it by `npm run db:postgres`, and a test fails if the two
 * drift apart.
 *
 * Pure text functions, so the test needs no database and no Prisma CLI.
 */

/** Where the Postgres Prisma client is generated, relative to its schema. */
export const POSTGRES_CLIENT_OUTPUT = '../../src/generated/postgres';

const HEADER = [
  '// GENERATED from prisma/schema.prisma by `npm run db:postgres`. Do not edit.',
  '// The hosted store (Neon, through Firebase App Hosting) uses this copy.',
  '',
].join('\n');

/** The SQLite schema, rewritten for Postgres. */
export function toPostgresSchema(sqliteSchema: string): string {
  const withProvider = sqliteSchema.replace(
    /(datasource\s+db\s*\{[^}]*provider\s*=\s*)"sqlite"/,
    '$1"postgresql"',
  );
  if (withProvider === sqliteSchema) {
    throw new Error('prisma/schema.prisma has no sqlite datasource to convert.');
  }
  const withOutput = withProvider.replace(
    /(generator\s+client\s*\{[^}]*provider\s*=\s*"prisma-client-js")/,
    `$1\n  output   = "${POSTGRES_CLIENT_OUTPUT}"`,
  );
  if (withOutput === withProvider) {
    throw new Error('prisma/schema.prisma has no prisma-client-js generator to convert.');
  }
  return HEADER + withOutput;
}

/**
 * Makes Prisma's "create everything" script safe to run on every start.
 *
 * The app runs this itself the first time it talks to the database, so
 * nobody has to run a migration command against Neon by hand. Tables and
 * indexes get IF NOT EXISTS. Foreign keys have no such option in Postgres,
 * so each one is wrapped to ignore "already exists".
 *
 * Limit: a new column on an existing table is not added this way. When a
 * later change needs one, add an ALTER TABLE ... ADD COLUMN IF NOT EXISTS
 * line to EXTRA_STATEMENTS in scripts/postgres-schema.ts.
 */
export function makeIdempotent(sql: string): string {
  const statements = sql
    .split(/;\s*\n/)
    .map((s) =>
      s
        .split('\n')
        .filter((line) => !line.trim().startsWith('--'))
        .join('\n')
        .trim(),
    )
    .filter((s) => s.length > 0);

  return statements
    .map((statement) => {
      if (/^CREATE TABLE /.test(statement)) {
        return statement.replace(/^CREATE TABLE /, 'CREATE TABLE IF NOT EXISTS ') + ';';
      }
      if (/^CREATE (UNIQUE )?INDEX /.test(statement)) {
        return statement.replace(/^CREATE (UNIQUE )?INDEX /, 'CREATE $1INDEX IF NOT EXISTS ') + ';';
      }
      if (/^ALTER TABLE .* ADD CONSTRAINT /s.test(statement)) {
        return [
          'DO $$ BEGIN',
          `  ${statement};`,
          'EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;',
          'END $$;',
        ].join('\n');
      }
      return statement + ';';
    })
    .join('\n\n');
}

/** Model names in a Prisma schema, for the test that checks every table is created. */
export function modelNames(schema: string): string[] {
  return [...schema.matchAll(/^model\s+(\w+)\s*\{/gm)].map((m) => m[1] ?? '');
}
