/**
 * Text safety for anything a person types.
 *
 * React escapes values it renders, so this is not about HTML on the page. It
 * is about what we store and what we put into an Excel or PDF export later:
 * no control characters, no runaway length, no spreadsheet formula injection.
 *
 * Brief section 7: sanitize and escape all user text.
 */

/** Strips control characters, collapses whitespace and clamps the length. */
export function plainText(value: unknown, maxLength = 280): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

/** Like plainText but keeps paragraph breaks, for longer comments. */
export function multilineText(value: unknown, maxLength = 2000): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trimEnd())
    .join('\n')
    .trim()
    .slice(0, maxLength);
}

/**
 * Excel treats a leading =, +, - or @ as a formula. Prefix those so an
 * exported comment can never run as one when someone opens the report.
 */
export function spreadsheetSafe(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

/** First name only, for the arrival wall and lucky draw on the big screen. */
export function firstName(fullName: string): string {
  const cleaned = plainText(fullName, 120);
  const first = cleaned.split(' ')[0] ?? '';
  return first;
}

/** "Ahmad bin Yusof" to "AY", for a small avatar with no photo. */
export function initials(fullName: string): string {
  const words = plainText(fullName, 120)
    .split(' ')
    .filter((word) => word.length > 1 && /^[A-Za-z]/.test(word));
  const picked = [words[0], words[words.length - 1]].filter(Boolean) as string[];
  const letters = (picked.length > 0 ? picked : ['?']).map((word) => word[0]?.toUpperCase() ?? '');
  return [...new Set(letters)].join('').slice(0, 2) || '?';
}
