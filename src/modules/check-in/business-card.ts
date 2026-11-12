/**
 * Checking people in from the digital business card in their TNB app.
 *
 * That QR holds a vCard: name, mobile, work email, office address, division
 * and job title. No staff number. So the desk matches on the email first,
 * then on the name.
 *
 * Only the name and the email are read. The phone number and the address
 * are never kept, sent on or logged.
 *
 * Names are written many ways ("Mohd" or "Muhammad", "binti" or "bt",
 * "Ir." in front), so they are compared in a normalised form. An exact
 * match checks the person in straight away. A close one is shown to the
 * desk to confirm, because a wrong check in is worse than one extra tap.
 *
 * Pure functions only, see business-card.test.ts.
 */

export type BusinessCard = {
  name: string;
  email: string;
};

/** A cheap first look, so the scanner knows to send the whole text. */
export function looksLikeBusinessCard(raw: string): boolean {
  return /^\s*(BEGIN:VCARD|MECARD:)/i.test(raw);
}

function unescapeVCard(value: string): string {
  return value
    .replace(/\\n/gi, ' ')
    .replace(/\\([,;:\\])/g, '$1')
    .trim();
}

/** Splits on a separator that is not escaped with a backslash. */
function splitUnescaped(value: string, separator: string): string[] {
  const parts: string[] = [];
  let current = '';
  for (let i = 0; i < value.length; i += 1) {
    const ch = value[i] ?? '';
    if (ch === '\\' && i + 1 < value.length) {
      current += ch + (value[i + 1] ?? '');
      i += 1;
    } else if (ch === separator) {
      parts.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  parts.push(current);
  return parts;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cleanEmail(value: string): string {
  const email = value.trim().toLowerCase();
  return EMAIL_PATTERN.test(email) ? email : '';
}

function cleanName(value: string): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, 160);
}

function parseVCard(raw: string): BusinessCard | null {
  // Long lines may be folded: a line break followed by a space or tab.
  const lines = raw
    .replace(/\r\n?/g, '\n')
    .replace(/\n[ \t]/g, '')
    .split('\n');

  let formatted = '';
  let structured = '';
  let email = '';

  for (const line of lines) {
    const colon = line.indexOf(':');
    if (colon <= 0) continue;
    // "EMAIL;TYPE=internet" -> "EMAIL". Group prefixes such as "item1." too.
    const property = (line.slice(0, colon).split(';')[0] ?? '').split('.').pop()?.toUpperCase();
    const value = line.slice(colon + 1);

    if (property === 'FN' && !formatted) formatted = unescapeVCard(value);
    if (property === 'N' && !structured) {
      // N is family;given;additional;prefix;suffix. The TNB card puts the
      // whole name in "given", others split it. Given names first either way.
      const [family = '', given = '', additional = ''] = splitUnescaped(value, ';').map(
        unescapeVCard,
      );
      structured = [given, additional, family].filter(Boolean).join(' ');
    }
    if (property === 'EMAIL' && !email) email = cleanEmail(unescapeVCard(value));
  }

  const name = cleanName(formatted || structured);
  return name || email ? { name, email } : null;
}

function parseMeCard(raw: string): BusinessCard | null {
  const body = raw.trim().replace(/^MECARD:/i, '');
  let name = '';
  let email = '';
  for (const field of splitUnescaped(body, ';')) {
    const colon = field.indexOf(':');
    if (colon <= 0) continue;
    const key = field.slice(0, colon).toUpperCase();
    const value = unescapeVCard(field.slice(colon + 1));
    if (key === 'N' && !name) {
      // MECARD writes "family,given".
      const [family = '', given = ''] = splitUnescaped(value, ',').map((s) => s.trim());
      name = [given, family].filter(Boolean).join(' ');
    }
    if (key === 'EMAIL' && !email) email = cleanEmail(value);
  }
  name = cleanName(name);
  return name || email ? { name, email } : null;
}

/** The name and email from a scanned business card, or null if it is not one. */
export function parseBusinessCard(raw: string): BusinessCard | null {
  const text = raw.trim();
  if (/^BEGIN:VCARD/i.test(text)) return parseVCard(text);
  if (/^MECARD:/i.test(text)) return parseMeCard(text);
  return null;
}

/* ------------------------------------------------------------ name matching */

/** Titles that come and go between lists. "Tun" stays: it can be part of a name. */
const HONORIFICS = new Set([
  'ir',
  'ts',
  'dr',
  'prof',
  'datuk',
  'dato',
  'datin',
  'hj',
  'haji',
  'hajah',
  'hjh',
  'en',
  'encik',
  'pn',
  'puan',
  'cik',
  'mr',
  'mrs',
  'ms',
  'sr',
]);

/** Words that join a name to a parent's, spelled many ways, and left out. */
const CONNECTORS = new Set(['bin', 'binti', 'bte', 'binte', 'bt', 'b', 'al', 'ap', 'a', 'l', 'p']);

/** Different spellings of the same name. */
const SAME_NAME: Record<string, string> = {
  mohd: 'muhammad',
  md: 'muhammad',
  muhd: 'muhammad',
  mohamad: 'muhammad',
  mohammad: 'muhammad',
  mohamed: 'muhammad',
  mohammed: 'muhammad',
  muhamad: 'muhammad',
  muhammed: 'muhammad',
  abd: 'abdul',
};

/** The words of a name that matter for matching, in order. */
export function nameTokens(name: string): string[] {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\b[ads]\/[lpo]\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((word) => word.length > 0 && !HONORIFICS.has(word) && !CONNECTORS.has(word))
    .map((word) => SAME_NAME[word] ?? word);
}

/** 0 to 1: how many of the words two names share. */
export function nameSimilarity(a: string, b: string): number {
  const left = new Set(nameTokens(a));
  const right = new Set(nameTokens(b));
  if (left.size === 0 || right.size === 0) return 0;
  let shared = 0;
  for (const word of left) if (right.has(word)) shared += 1;
  return shared / Math.max(left.size, right.size);
}

/** Close enough to offer as "is this them?". */
const SUGGEST_AT = 0.5;
const MAX_SUGGESTIONS = 4;

type Person = { id: string; name: string; email?: string };

export type CardMatch<T extends Person> =
  | { kind: 'match'; attendee: T; by: 'email' | 'name' }
  | { kind: 'choose'; candidates: T[] }
  | { kind: 'none' };

export function matchBusinessCard<T extends Person>(card: BusinessCard, people: T[]): CardMatch<T> {
  if (card.email) {
    const byEmail = people.filter((p) => p.email && p.email.toLowerCase() === card.email);
    if (byEmail.length === 1 && byEmail[0]) {
      return { kind: 'match', attendee: byEmail[0], by: 'email' };
    }
  }

  if (!card.name) return { kind: 'none' };

  const key = nameTokens(card.name).join(' ');
  const exact = people.filter((p) => nameTokens(p.name).join(' ') === key);
  if (exact.length === 1 && exact[0]) return { kind: 'match', attendee: exact[0], by: 'name' };
  if (exact.length > 1) return { kind: 'choose', candidates: exact.slice(0, MAX_SUGGESTIONS) };

  const close = people
    .map((person) => ({ person, score: nameSimilarity(card.name, person.name) }))
    .filter((entry) => entry.score >= SUGGEST_AT)
    .sort((x, y) => y.score - x.score || x.person.name.localeCompare(y.person.name))
    .slice(0, MAX_SUGGESTIONS)
    .map((entry) => entry.person);

  return close.length > 0 ? { kind: 'choose', candidates: close } : { kind: 'none' };
}
