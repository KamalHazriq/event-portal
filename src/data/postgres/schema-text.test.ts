import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { POSTGRES_SCHEMA_SQL } from './schema-sql';
import { makeIdempotent, modelNames, toPostgresSchema } from './schema-text';

const read = (...parts: string[]) => readFileSync(path.join(process.cwd(), ...parts), 'utf8');

describe('the Postgres schema copy', () => {
  const main = read('prisma', 'schema.prisma');

  it('matches the main schema. If this fails, run "npm run db:postgres" and commit', () => {
    expect(read('prisma', 'postgres', 'schema.prisma')).toBe(toPostgresSchema(main));
  });

  it('creates every table in the main schema', () => {
    for (const model of modelNames(main)) {
      expect(POSTGRES_SCHEMA_SQL).toContain(`CREATE TABLE IF NOT EXISTS "${model}"`);
    }
  });

  it('only switches the provider and the client output', () => {
    const converted = toPostgresSchema(main);
    expect(converted).toContain('provider = "postgresql"');
    expect(converted).not.toContain('"sqlite"');
    expect(converted).toContain('output   = "../../src/generated/postgres"');
  });
});

describe('makeIdempotent', () => {
  it('turns a create script into one that can run again', () => {
    const sql = [
      '-- CreateTable',
      'CREATE TABLE "A" (',
      '    "id" TEXT NOT NULL',
      ');',
      '',
      '-- CreateIndex',
      'CREATE UNIQUE INDEX "A_id_key" ON "A"("id");',
      '',
      'CREATE INDEX "A_x_idx" ON "A"("id");',
      '',
      '-- AddForeignKey',
      'ALTER TABLE "B" ADD CONSTRAINT "B_a_fkey" FOREIGN KEY ("a") REFERENCES "A"("id");',
      '',
    ].join('\n');
    const out = makeIdempotent(sql);
    expect(out).toContain('CREATE TABLE IF NOT EXISTS "A"');
    expect(out).toContain('CREATE UNIQUE INDEX IF NOT EXISTS "A_id_key"');
    expect(out).toContain('CREATE INDEX IF NOT EXISTS "A_x_idx"');
    expect(out).toContain('EXCEPTION WHEN duplicate_object');
    expect(out).not.toContain('--');
  });
});
