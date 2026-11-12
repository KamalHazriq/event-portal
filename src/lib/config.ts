/**
 * Loads and validates config/event.json.
 *
 * Nothing else in the app reads that file directly. Pages call
 * getEventConfig() and get a fully typed, already validated object.
 *
 * Brief section 5: validate on startup and show a clear error if invalid.
 */
import { readFileSync, statSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { ZodError } from 'zod';

import { EventConfigSchema, type EventConfig } from './event-schema';

export const DEFAULT_CONFIG_PATH = 'config/event.json';

/** A validation or read failure, already written in plain English. */
export class ConfigError extends Error {
  readonly problems: string[];
  readonly filePath: string;

  constructor(filePath: string, problems: string[]) {
    super(`${filePath} is not valid:\n  - ${problems.join('\n  - ')}`);
    this.name = 'ConfigError';
    this.filePath = filePath;
    this.problems = problems;
  }
}

export function resolveConfigPath(): string {
  const fromEnv = process.env.EVENT_CONFIG_PATH?.trim();
  const relative = fromEnv && fromEnv.length > 0 ? fromEnv : DEFAULT_CONFIG_PATH;
  if (isAbsolute(relative)) return relative;

  // turbopackIgnore: the path is only known at runtime, so the bundler would
  // otherwise copy the whole project (source and public folder included) into
  // the server output. next.config.ts traces ./config/** on purpose instead.
  return join(/* turbopackIgnore: true */ process.cwd(), relative);
}

/** Turns zod issues into lines a non-developer can act on. */
function describeIssues(error: ZodError): string[] {
  return error.issues.map((issue) => {
    const where = issue.path.length > 0 ? issue.path.join('.') : '(top level)';
    return `${where}: ${issue.message}`;
  });
}

type CacheEntry = { mtimeMs: number; config: EventConfig };

let cache: CacheEntry | null = null;

/**
 * Reads, parses and validates the config file.
 *
 * In development the file is re-read when it changes on disk, so you can edit
 * the agenda and refresh the browser. In production it is read once.
 */
export function loadEventConfig(): EventConfig {
  const filePath = resolveConfigPath();
  const isProduction = process.env.NODE_ENV === 'production';

  let mtimeMs = 0;
  if (!isProduction) {
    try {
      mtimeMs = statSync(filePath).mtimeMs;
    } catch {
      throw new ConfigError(filePath, [
        'the file could not be found. Copy config/event.json from the repository, or set EVENT_CONFIG_PATH in .env.local to point at your file.',
      ]);
    }
    if (cache && cache.mtimeMs === mtimeMs) return cache.config;
  } else if (cache) {
    return cache.config;
  }

  let raw: string;
  try {
    raw = readFileSync(filePath, 'utf8');
  } catch {
    throw new ConfigError(filePath, [
      'the file could not be read. Check the path and that the file is not open in another program.',
    ]);
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'unknown parse error';
    throw new ConfigError(filePath, [
      `the file is not valid JSON (${detail}). A missing comma or a trailing comma is the usual cause.`,
    ]);
  }

  const result = EventConfigSchema.safeParse(json);
  if (!result.success) {
    throw new ConfigError(filePath, describeIssues(result.error));
  }

  const config = withEnvironment(result.data);
  cache = { mtimeMs, config };
  return config;
}

/**
 * PORTAL_URL, when set, replaces event.portalUrl. The hosted address is only
 * known once Firebase gives it out, and this way it is set next to the other
 * hosting settings in apphosting.yaml, not by editing the event file.
 */
function withEnvironment(config: EventConfig): EventConfig {
  const portalUrl = process.env.PORTAL_URL?.trim();
  if (!portalUrl) return config;
  try {
    new URL(portalUrl);
  } catch {
    throw new ConfigError('PORTAL_URL', [`"${portalUrl}" is not a full web address.`]);
  }
  return { ...config, event: { ...config.event, portalUrl } };
}

/** Same as loadEventConfig, but returns the error instead of throwing. */
export function tryLoadEventConfig():
  { ok: true; config: EventConfig } | { ok: false; error: ConfigError } {
  try {
    return { ok: true, config: loadEventConfig() };
  } catch (error) {
    if (error instanceof ConfigError) return { ok: false, error };
    throw error;
  }
}

/** The normal way pages get the config. */
export function getEventConfig(): EventConfig {
  return loadEventConfig();
}

/** Only for tests, so one test file does not see another file's cache. */
export function clearConfigCache(): void {
  cache = null;
}
