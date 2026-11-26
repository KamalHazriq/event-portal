/**
 * The screensaver loop for the big screen: teka-teki (riddles) that reveal
 * their answer after a pause, "Do you know?" facts, and introductions of new
 * leads and heads. The secretariat writes the content on /admin/screensaver;
 * the projector cycles through it during breaks.
 *
 * Pure functions only. See logic.test.ts.
 */
export const LOOP_KEY = 'loop.content';
export const LOOP_PHOTO_PREFIX = 'loop.photo.';

export type Riddle = { q: string; a: string };
export type Lead = { id: string; name: string; role: string };
export type LoopContent = {
  riddles: Riddle[];
  facts: string[];
  leads: Lead[];
  /** Add facts worked out from the live numbers (people, sessions, check ins, photos). */
  liveFacts: boolean;
};

export const MAX_ITEMS = 60;

/** A few traditional riddles to start from. Edit or replace them on the page. */
export const DEFAULT_LOOP: LoopContent = {
  riddles: [
    { q: 'Apa yang makin diambil, makin besar?', a: 'Lubang' },
    { q: 'Apa yang naik tetapi tidak pernah turun?', a: 'Umur' },
    { q: 'Ada kunci tetapi tidak boleh membuka pintu. Apa dia?', a: 'Papan kekunci (keyboard)' },
  ],
  facts: [],
  leads: [],
  liveFacts: true,
};

function clean(value: unknown, max: number): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

/** "Question | Answer" on each line. A line with no answer is left out. */
export function parseRiddleLines(text: string): Riddle[] {
  const out: Riddle[] = [];
  for (const line of text.split(/\r?\n/)) {
    const cut = line.lastIndexOf('|');
    if (cut < 0) continue;
    const q = clean(line.slice(0, cut), 200);
    const a = clean(line.slice(cut + 1), 120);
    if (q && a) out.push({ q, a });
    if (out.length >= MAX_ITEMS) break;
  }
  return out;
}

/** One fact per line. */
export function parseFactLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => clean(l, 240))
    .filter(Boolean)
    .slice(0, MAX_ITEMS);
}

export function riddlesToText(riddles: Riddle[]): string {
  return riddles.map((r) => `${r.q} | ${r.a}`).join('\n');
}

/** What is stored, or the defaults when nothing has been saved. A damaged value falls back too. */
export function parseLoop(raw: string | null): LoopContent {
  if (raw === null) return DEFAULT_LOOP;
  try {
    const v = JSON.parse(raw) as Partial<LoopContent>;
    return {
      riddles: (Array.isArray(v.riddles) ? v.riddles : [])
        .map((r) => ({ q: clean(r?.q, 200), a: clean(r?.a, 120) }))
        .filter((r) => r.q && r.a),
      facts: (Array.isArray(v.facts) ? v.facts : []).map((f) => clean(f, 240)).filter(Boolean),
      leads: (Array.isArray(v.leads) ? v.leads : [])
        .map((l) => ({ id: clean(l?.id, 40), name: clean(l?.name, 80), role: clean(l?.role, 120) }))
        .filter((l) => l.id && l.name),
      liveFacts: v.liveFacts !== false,
    };
  } catch {
    return DEFAULT_LOOP;
  }
}

export type LoopItem =
  | { kind: 'riddle'; q: string; a: string }
  | { kind: 'fact'; text: string }
  | { kind: 'lead'; id: string; name: string; role: string };

/**
 * The order the projector cycles in: one of each kind in turn, so a riddle is
 * followed by a fact and then a lead, rather than all the riddles together.
 */
export function buildLoopItems(content: LoopContent): LoopItem[] {
  const lists: LoopItem[][] = [
    content.riddles.map((r) => ({ kind: 'riddle' as const, ...r })),
    content.facts.map((text) => ({ kind: 'fact' as const, text })),
    content.leads.map((l) => ({ kind: 'lead' as const, ...l })),
  ];
  const out: LoopItem[] = [];
  const longest = Math.max(0, ...lists.map((l) => l.length));
  for (let i = 0; i < longest; i++) {
    for (const list of lists) {
      const item = list[i];
      if (item) out.push(item);
    }
  }
  return out;
}

/** Where the secretariat's Reveal / Next presses are stored. */
export const LOOP_COMMAND_KEY = 'loop.command';

export type LoopCommand = { seq: number; action: 'reveal' | 'next' };

export function parseLoopCommand(raw: string | null | undefined): LoopCommand {
  try {
    const v = JSON.parse(raw ?? '') as Partial<LoopCommand>;
    if (typeof v.seq === 'number' && (v.action === 'reveal' || v.action === 'next')) {
      return { seq: v.seq, action: v.action };
    }
  } catch {
    // fall through
  }
  return { seq: 0, action: 'next' };
}

/** How long each card stays up, in milliseconds. A riddle shows its question first. */
export const SHOW_MS = { riddleQuestion: 9_000, riddleAnswer: 6_000, fact: 11_000, lead: 11_000 };

/** A small JPEG as a data address, or null. Stops anything else being stored as a photo. */
export function safePhoto(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  if (!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(value)) return null;
  return value.length <= 400_000 ? value : null;
}

/* ------------------------------------------------------------ ready-made */

export type RiddlePack = { id: string; title: string; riddles: Riddle[] };

/** Ready-made riddle packs the secretariat can add with one press. */
export const RIDDLE_PACKS: RiddlePack[] = [
  {
    id: 'malay',
    title: 'Teka-teki (Bahasa Malaysia)',
    riddles: [
      { q: 'Apa yang makin diambil, makin besar?', a: 'Lubang' },
      { q: 'Apa yang naik tetapi tidak pernah turun?', a: 'Umur' },
      { q: 'Ada kunci tetapi tidak boleh membuka pintu. Apa dia?', a: 'Papan kekunci (keyboard)' },
      { q: 'Apa yang basah apabila mengeringkan?', a: 'Tuala' },
      { q: 'Apa yang hilang apabila namanya disebut?', a: 'Senyap' },
      { q: 'Ada tangan tetapi tidak boleh bertepuk. Apa dia?', a: 'Jam' },
      { q: 'Apa yang boleh pecah tanpa disentuh?', a: 'Janji' },
      { q: 'Saya mengalir dalam wayar tanpa kaki. Apa saya?', a: 'Arus elektrik' },
    ],
  },
  {
    id: 'english',
    title: 'Riddles (English)',
    riddles: [
      { q: 'What has keys but cannot open locks?', a: 'A piano' },
      { q: 'What gets wetter the more it dries?', a: 'A towel' },
      { q: 'What can you catch but not throw?', a: 'A cold' },
      { q: 'What has cities but no houses, and water but no fish?', a: 'A map' },
      { q: 'What has a head and a tail but no body?', a: 'A coin' },
      { q: 'What is full of holes but still holds water?', a: 'A sponge' },
      { q: 'What can travel around the world while staying in a corner?', a: 'A stamp' },
      {
        q: 'What flows through wires, has no legs, and can be alternating or direct?',
        a: 'Current',
      },
    ],
  },
];

/** The riddles of a pack that are not in the list yet. */
export function missingFromPack(current: Riddle[], pack: RiddlePack): Riddle[] {
  const have = new Set(current.map((r) => r.q.toLowerCase()));
  return pack.riddles.filter((r) => !have.has(r.q.toLowerCase()));
}

/**
 * "Do you know?" facts worked out from the live numbers, so there is
 * always something true to show without anyone writing it. Zero counts are
 * left out, so nothing says "0 photos".
 */
export function liveFactTexts(stats: {
  people: number;
  days: number;
  sessions: number;
  venue: string;
  checkedIn: number;
  photos: number;
  comments: number;
}): string[] {
  const out: string[] = [];
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  if (stats.people > 0) {
    out.push(
      `${plural(stats.people, 'colleague is', 'colleagues are')} on the list for this summit${stats.venue ? `, at ${stats.venue}` : ''}.`,
    );
  }
  if (stats.sessions > 0 && stats.days > 0) {
    out.push(
      `The summit has ${plural(stats.sessions, 'session', 'sessions')} over ${plural(stats.days, 'day', 'days')}.`,
    );
  }
  if (stats.checkedIn > 0) {
    out.push(`${plural(stats.checkedIn, 'person has', 'people have')} checked in today.`);
  }
  if (stats.photos > 0) {
    out.push(`${plural(stats.photos, 'photo has', 'photos have')} been shared on the photo wall.`);
  }
  if (stats.comments > 0) {
    out.push(`${plural(stats.comments, 'comment has', 'comments have')} been posted so far.`);
  }
  return out;
}
