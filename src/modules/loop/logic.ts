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
export type LoopContent = { riddles: Riddle[]; facts: string[]; leads: Lead[] };

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

/** How long each card stays up, in milliseconds. A riddle shows its question first. */
export const SHOW_MS = { riddleQuestion: 9_000, riddleAnswer: 6_000, fact: 11_000, lead: 11_000 };

/** A small JPEG as a data address, or null. Stops anything else being stored as a photo. */
export function safePhoto(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  if (!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(value)) return null;
  return value.length <= 400_000 ? value : null;
}
