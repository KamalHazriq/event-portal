/**
 * The shape of config/event.json.
 *
 * Project brief rule 3: everything event-specific lives in config, never
 * hard-coded in components. To run this portal for another event you change
 * the JSON file, not the code.
 *
 * Everything here is validated on startup. If the file is wrong, the portal
 * says exactly what is wrong instead of failing in a strange way later.
 */
import { z } from 'zod';

/* ---------------------------------------------------------------- helpers */

const hexColour = z
  .string()
  .regex(
    /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/,
    'must be a hex colour like #0053A1',
  );

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be a date like 2026-12-14');

const clockTime = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'must be a 24-hour time like 09:00 or 14:30');

const localDateTime = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/,
    'must be a local date and time like 2026-12-15T21:00',
  );

/** An id used in URLs: lowercase letters, numbers and dashes. */
const id = z
  .string()
  .min(1)
  .max(64)
  .regex(
    /^[a-z0-9][a-z0-9-]*$/,
    'must be lowercase letters, numbers and dashes, like day-1-keynote',
  );

/** A link that opens in a browser, or a path inside this portal. */
const link = z
  .string()
  .min(1)
  .refine(
    (value) => value.startsWith('/') || /^https?:\/\//.test(value),
    'must start with https://, http:// or / for a file inside this portal',
  );

const timezone = z
  .string()
  .min(1)
  .refine((value) => {
    try {
      new Intl.DateTimeFormat('en-GB', { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }, 'must be a time zone name like Asia/Kuala_Lumpur');

/* ------------------------------------------------------------------ theme */

/**
 * Colours are theme tokens, not fixed values. The brief says the look and
 * feel is not decided yet and the theme will come from whoever designs the
 * event slides. These become CSS variables at runtime, so a new theme needs
 * no rebuild, only an edit to this file.
 */
export const ThemeTokensSchema = z.object({
  background: hexColour,
  surface: hexColour,
  surfaceMuted: hexColour,
  border: hexColour,
  text: hexColour,
  textMuted: hexColour,
  primary: hexColour,
  primaryText: hexColour,
  accent: hexColour,
  accentText: hexColour,
  live: hexColour,
  success: hexColour,
  warning: hexColour,
});

export const BrandingSchema = z.object({
  /** The event wordmark, for light backgrounds (and anything printed). */
  logoPath: z.string().default('/branding/event-wordmark.webp'),
  /** The same wordmark with light lettering, for dark backgrounds. */
  logoDarkPath: z.string().optional(),
  /** A small mark for page headers, such as the organiser's monogram. */
  markPath: z.string().optional(),
  markDarkPath: z.string().optional(),
  /** The organiser's full logo, shown in the page footer on a white tile. */
  organisationLogoPath: z.string().optional(),
  organisationName: z.string().max(120).default(''),
  /** Square PNG for the browser tab and the phone home screen. */
  iconPath: z.string().optional(),
  appleIconPath: z.string().optional(),
  fontFamily: z.string().default('Arial, Helvetica, sans-serif'),
  /** Used for the big numbers on the projector. Falls back to fontFamily. */
  displayFontFamily: z.string().optional(),
  /** Named brand colours, kept separate from the semantic tokens above. */
  brand: z.object({
    primary: hexColour,
    navy: hexColour,
    panel: hexColour,
  }),
  themes: z.object({ light: ThemeTokensSchema, dark: ThemeTokensSchema }),
  defaultTheme: z.enum(['light', 'dark']).default('light'),
  /** The projector often wants the opposite of the phone theme. */
  bigScreenTheme: z.enum(['light', 'dark']).default('dark'),
});

/* ----------------------------------------------------------------- people */

export const SpeakerSchema = z.object({
  id,
  name: z.string().min(1).max(120),
  title: z.string().max(200).default(''),
  organisation: z.string().max(160).default(''),
  bio: z.string().max(1200).default(''),
  photoPath: z.string().optional(),
});

/* --------------------------------------------------------------- sessions */

/**
 * talk, breakout, activity and break are the four types named in the brief.
 * panel, meal and logistics were added so a real 3 day agenda (dinner,
 * registration, closing) can be described without stretching the others.
 * Adding a type here is a config change only, no component changes.
 */
export const sessionTypes = [
  'talk',
  'panel',
  'breakout',
  'activity',
  'break',
  'meal',
  'logistics',
] as const;

export type SessionType = (typeof sessionTypes)[number];

/** Slido lives in config so a new event only has to swap the link. */
export const SlidoRefSchema = z.object({
  eventUrl: z.string().url().optional(),
  eventCode: z.string().max(40).optional(),
  label: z.string().max(60).default('Join Slido'),
});

export const SessionSchema = z
  .object({
    id,
    start: clockTime,
    end: clockTime,
    title: z.string().min(1).max(160),
    description: z.string().max(1500).default(''),
    objectives: z.array(z.string().min(1).max(300)).default([]),
    speakerIds: z.array(id).default([]),
    room: z.string().max(120).default(''),
    type: z.enum(sessionTypes),
    qaEnabled: z.boolean().default(false),
    feedbackEnabled: z.boolean().default(false),
    /** Overrides integrations.slido for this session only. */
    slido: SlidoRefSchema.optional(),
    /** Set true to keep a session in the file but off the public agenda. */
    hidden: z.boolean().default(false),
  })
  .refine((session) => session.end > session.start, {
    message: 'end time must be after start time',
    path: ['end'],
  });

export const DaySchema = z
  .object({
    id,
    date: isoDate,
    label: z.string().min(1).max(80),
    subtitle: z.string().max(200).default(''),
    sessions: z.array(SessionSchema).min(1, 'a day needs at least one session'),
  })
  .refine((day) => new Set(day.sessions.map((s) => s.id)).size === day.sessions.length, {
    message: 'two sessions on this day share the same id',
    path: ['sessions'],
  });

/* -------------------------------------------------------------- the event */

export const ResourceSchema = z.object({
  id,
  title: z.string().min(1).max(160),
  url: link,
  description: z.string().max(400).default(''),
  /** "file" shows a download hint in the UI. */
  kind: z.enum(['link', 'file']).default('link'),
});

export const SurpriseSchema = z.object({
  enabled: z.boolean().default(false),
  label: z.string().max(80).default('Starting soon'),
  /** Local time in the event time zone. */
  targetAt: localDateTime,
});

/**
 * Module switches, so one build can serve a big summit and a small town hall.
 * Anything not built yet stays off.
 */
export const FeaturesSchema = z.object({
  schedule: z.boolean().default(true),
  resources: z.boolean().default(true),
  checkIn: z.boolean().default(false),
  feedback: z.boolean().default(false),
  bigScreen: z.boolean().default(false),
  arrivalWall: z.boolean().default(false),
  luckyDraw: z.boolean().default(false),
  photoWall: z.boolean().default(false),
  committees: z.boolean().default(false),
  qa: z.boolean().default(false),
  polls: z.boolean().default(false),
});

export const EventInfoSchema = z.object({
  name: z.string().min(1).max(160),
  shortName: z.string().min(1).max(60),
  tagline: z.string().max(200).default(''),
  startDate: isoDate,
  endDate: isoDate,
  venue: z.string().min(1).max(200),
  city: z.string().max(120).default(''),
  timezone: timezone.default('Asia/Kuala_Lumpur'),
  /** The one URL behind every QR code. Used by the big screen and name tags. */
  portalUrl: z.string().url().default('https://example.invalid/portal'),
  helpText: z.string().max(300).default(''),
});

export const EventConfigSchema = z
  .object({
    configVersion: z.literal(1),
    event: EventInfoSchema,
    branding: BrandingSchema,
    features: FeaturesSchema.prefault({}),
    integrations: z
      .object({
        slido: SlidoRefSchema.extend({ enabled: z.boolean().default(false) }).optional(),
      })
      .prefault({}),
    days: z.array(DaySchema).min(1, 'the event needs at least one day'),
    speakers: z.array(SpeakerSchema).default([]),
    resources: z.array(ResourceSchema).default([]),
    surprise: SurpriseSchema.optional(),
    /**
     * Polls prepared ahead of time for the backup polls (Module 3). An admin
     * loads them with one button; they can also be typed in on the day.
     */
    polls: z
      .array(
        z.object({
          id: z.string().regex(/^[a-z0-9-]{1,32}$/),
          question: z.string().min(1).max(200),
          kind: z.enum(['single', 'multiple', 'wordcloud']),
          options: z.array(z.string().min(1).max(80)).max(8).default([]),
        }),
      )
      .max(30)
      .default([]),
    /**
     * Committees whose Excel an admin can upload for a read only summary,
     * such as SVC, ATC and OTC. The id is used in addresses and storage.
     */
    committees: z
      .array(
        z.object({
          id: z.string().regex(/^[a-z0-9-]{1,24}$/, 'use lower case letters, numbers and dashes'),
          name: z.string().min(1).max(60),
        }),
      )
      .max(12)
      .default([]),
  })
  /* ----- checks that span more than one field ----- */
  .refine((config) => config.event.endDate >= config.event.startDate, {
    message: 'event.endDate must not be before event.startDate',
    path: ['event', 'endDate'],
  })
  .refine((config) => new Set(config.days.map((d) => d.id)).size === config.days.length, {
    message: 'two days share the same id',
    path: ['days'],
  })
  .refine((config) => new Set(config.days.map((d) => d.date)).size === config.days.length, {
    message: 'two days share the same date',
    path: ['days'],
  })
  .refine(
    (config) =>
      config.days.every(
        (day) => day.date >= config.event.startDate && day.date <= config.event.endDate,
      ),
    {
      message: 'every day date must fall between event.startDate and event.endDate',
      path: ['days'],
    },
  )
  .refine(
    (config) => {
      const ids = config.days.flatMap((day) => day.sessions.map((s) => s.id));
      return new Set(ids).size === ids.length;
    },
    { message: 'session ids must be unique across the whole event', path: ['days'] },
  )
  .refine(
    (config) => {
      // The feedback module reserves these for the whole event form, so a
      // session using one would make /feedback/event ambiguous.
      const reserved = new Set(['event', 'event-final']);
      return config.days.every((day) => day.sessions.every((s) => !reserved.has(s.id)));
    },
    {
      message: 'a session id may not be "event" or "event-final", which the feedback form uses',
      path: ['days'],
    },
  )
  .refine((config) => new Set(config.speakers.map((s) => s.id)).size === config.speakers.length, {
    message: 'two speakers share the same id',
    path: ['speakers'],
  })
  .refine(
    (config) => {
      const known = new Set(config.speakers.map((s) => s.id));
      return config.days.every((day) =>
        day.sessions.every((session) => session.speakerIds.every((sid) => known.has(sid))),
      );
    },
    {
      message:
        'a session lists a speakerId that is not in the speakers list. Check for a typo or add the speaker.',
      path: ['days'],
    },
  )
  .refine((config) => new Set(config.resources.map((r) => r.id)).size === config.resources.length, {
    message: 'two resources share the same id',
    path: ['resources'],
  })
  .refine(
    (config) => {
      const slido = config.integrations.slido;
      if (!slido?.enabled) return true;
      return Boolean(slido.eventUrl ?? slido.eventCode);
    },
    {
      message: 'integrations.slido is enabled, so it needs an eventUrl or an eventCode',
      path: ['integrations', 'slido'],
    },
  )
  .refine(
    (config) => {
      if (!config.surprise?.enabled) return true;
      const date = config.surprise.targetAt.slice(0, 10);
      return date >= config.event.startDate && date <= config.event.endDate;
    },
    {
      message: 'surprise.targetAt should fall inside the event dates',
      path: ['surprise', 'targetAt'],
    },
  );

export type EventConfig = z.infer<typeof EventConfigSchema>;
export type EventInfo = EventConfig['event'];
export type Branding = EventConfig['branding'];
export type ThemeTokens = z.infer<typeof ThemeTokensSchema>;
export type Speaker = z.infer<typeof SpeakerSchema>;
export type Session = z.infer<typeof SessionSchema>;
export type Day = z.infer<typeof DaySchema>;
export type Resource = z.infer<typeof ResourceSchema>;
export type Surprise = z.infer<typeof SurpriseSchema>;
export type Features = EventConfig['features'];
export type SlidoRef = z.infer<typeof SlidoRefSchema>;
