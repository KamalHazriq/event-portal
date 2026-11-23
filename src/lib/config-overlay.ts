/**
 * Edits made on the secretariat pages (the agenda, the event details, the
 * info page, resources, department short names), kept in the database and
 * merged over config/event.json. The file is never rewritten: it stays the
 * starting point and the fallback, and "Reset" simply drops the edits.
 *
 * Sessions and speakers are stored as patches by id, so a change to the file
 * for something else still comes through. The info page, the resources and
 * the department list are replaced whole.
 *
 * Every merge is checked against the same schema as the file. An overlay
 * that does not fit (a session that no longer exists, an end before a start)
 * is ignored and the file is used, so a bad edit can never take the portal
 * down. Pure functions plus a little shared state. See config-overlay.test.ts.
 */
import {
  EventConfigSchema,
  type EventConfig,
  type EventInfo,
  type Resource,
  type Session,
  type Speaker,
} from './event-schema';

/** The settings key the overlay is stored under. */
export const OVERLAY_KEY = 'config.overlay';

export type SessionPatch = Partial<
  Pick<
    Session,
    | 'title'
    | 'start'
    | 'end'
    | 'room'
    | 'description'
    | 'type'
    | 'hidden'
    | 'feedbackEnabled'
    | 'qaEnabled'
    | 'speakerIds'
    | 'slidesUrl'
  >
>;

export type SpeakerPatch = Partial<Pick<Speaker, 'name' | 'title' | 'organisation' | 'bio'>>;

export type Info = NonNullable<EventConfig['info']>;
export type Departments = EventConfig['departments'];

export type ConfigOverlay = {
  event?: Partial<
    Pick<EventInfo, 'name' | 'shortName' | 'tagline' | 'venue' | 'city' | 'helpText'>
  >;
  footerText?: string;
  slido?: { eventUrl?: string; eventCode?: string };
  sessions?: Record<string, SessionPatch>;
  addedSessions?: { dayId: string; session: Session }[];
  speakers?: Record<string, SpeakerPatch>;
  addedSpeakers?: Speaker[];
  info?: Info;
  resources?: Resource[];
  departments?: Departments;
};

const KNOWN_KEYS = [
  'event',
  'footerText',
  'slido',
  'sessions',
  'addedSessions',
  'speakers',
  'addedSpeakers',
  'info',
  'resources',
  'departments',
] as const;

/** Reads the stored text. Anything that is not an object of known keys is dropped. */
export function parseOverlay(raw: string | null): ConfigOverlay {
  if (!raw) return {};
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
    const out: Record<string, unknown> = {};
    for (const key of KNOWN_KEYS)
      if (key in value) out[key] = (value as Record<string, unknown>)[key];
    return out as ConfigOverlay;
  } catch {
    return {};
  }
}

export function serialiseOverlay(overlay: ConfigOverlay): string | null {
  const keys = Object.keys(overlay).filter((k) => {
    const v = (overlay as Record<string, unknown>)[k];
    if (v === undefined) return false;
    if (Array.isArray(v)) return true; // an empty list can be a real choice (no resources)
    if (typeof v === 'object' && v !== null) return Object.keys(v).length > 0;
    return true;
  });
  if (keys.length === 0) return null;
  return JSON.stringify(
    Object.fromEntries(keys.map((k) => [k, (overlay as Record<string, unknown>)[k]])),
  );
}

/** Lays the overlay over the file's config. Not yet checked: see mergeConfig. */
export function applyOverlay(base: EventConfig, overlay: ConfigOverlay): EventConfig {
  const addedByDay = new Map<string, Session[]>();
  for (const added of overlay.addedSessions ?? []) {
    addedByDay.set(added.dayId, [...(addedByDay.get(added.dayId) ?? []), added.session]);
  }
  const speakerPatches = overlay.speakers ?? {};
  const sessionPatches = overlay.sessions ?? {};

  const slido = base.integrations.slido;
  const integrations = overlay.slido
    ? {
        ...base.integrations,
        slido: {
          label: slido?.label ?? 'Join Slido',
          ...slido,
          // A link typed in on the secretariat pages turns Slido on.
          enabled: slido?.enabled ?? Boolean(overlay.slido.eventUrl),
          ...overlay.slido,
        },
      }
    : base.integrations;

  return {
    ...base,
    event: { ...base.event, ...overlay.event },
    branding:
      overlay.footerText === undefined
        ? base.branding
        : { ...base.branding, footerText: overlay.footerText },
    integrations,
    days: base.days.map((day) => ({
      ...day,
      sessions: [
        ...day.sessions.map((s) => ({ ...s, ...sessionPatches[s.id] })),
        ...(addedByDay.get(day.id) ?? []),
      ],
    })),
    speakers: [
      ...base.speakers.map((s) => ({ ...s, ...speakerPatches[s.id] })),
      ...(overlay.addedSpeakers ?? []),
    ],
    info: overlay.info ?? base.info,
    resources: overlay.resources ?? base.resources,
    departments: overlay.departments ?? base.departments,
  };
}

/** Plain English lines from a failed check, like the file's own errors. */
export function describeProblems(
  error: { issues: { path: PropertyKey[]; message: string }[] },
  base: EventConfig,
): string[] {
  return error.issues.slice(0, 5).map((issue) => {
    // Name the session or speaker, not "days.0.sessions.4.end".
    const [first, dayIndex, second, itemIndex, field] = issue.path;
    let where = issue.path.join('.');
    if (first === 'days' && second === 'sessions' && typeof dayIndex === 'number') {
      const s = base.days[dayIndex]?.sessions[Number(itemIndex)];
      where = s ? `"${s.title}"${field ? ` (${String(field)})` : ''}` : where;
    }
    return `${where}: ${issue.message}`;
  });
}

export type MergeResult = { config: EventConfig; problems: string[] };

/**
 * The merged config, checked. If the overlay does not fit, the file's own
 * config comes back with the reasons, so nothing breaks.
 */
export function mergeConfig(base: EventConfig, raw: string | null): MergeResult {
  if (!raw) return { config: base, problems: [] };
  const merged = applyOverlay(base, parseOverlay(raw));
  const result = EventConfigSchema.safeParse(merged);
  if (!result.success) return { config: base, problems: describeProblems(result.error, base) };
  return { config: result.data, problems: [] };
}

/* ------------------------------------------------------------ shared state */

type Holder = { raw: string | null; checkedAt: number; inflight: Promise<void> | null };

/**
 * Next.js loads some modules more than once in one server (pages and route
 * handlers are bundled apart), so the stored text lives on the process.
 */
const HOLDER = Symbol.for('event-portal.config-overlay');

function holder(): Holder {
  const g = globalThis as unknown as Record<symbol, Holder | undefined>;
  return (g[HOLDER] ??= { raw: null, checkedAt: 0, inflight: null });
}

/** The overlay as last read, or null when there are no edits. */
export function overlayRaw(): string | null {
  return holder().raw;
}

export function setOverlayRaw(raw: string | null): void {
  const h = holder();
  h.raw = raw;
  h.checkedAt = Date.now();
}

export function overlayState(): Holder {
  return holder();
}
