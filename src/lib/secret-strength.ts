/**
 * Is a PIN or an event code easy to guess? Used by the Ready check, so the
 * secretariat is told before the event. Pure functions, see the test.
 */
const COMMON = new Set([
  '123456',
  '1234567',
  '12345678',
  '123456789',
  '654321',
  '246810',
  '135790',
  '000000',
  '111111',
  '222222',
  '123123',
  '112233',
  '121212',
  '696969',
  '999999',
  'password',
  'admin',
  'admin123',
  'secretariat',
  'qwerty',
]);

function allSame(value: string): boolean {
  return value.length > 0 && [...value].every((c) => c === value[0]);
}

/** Digits that count up or down by one, like 234567 or 987654. */
function runOfDigits(value: string): boolean {
  if (!/^\d{4,}$/.test(value)) return false;
  const steps = [...value].slice(1).map((c, i) => Number(c) - Number(value[i]));
  return steps.every((s) => s === 1) || steps.every((s) => s === -1);
}

/** Even steps, like 246810 (not digits only, so 2 4 6 8 10 is handled by the common list). */
function evenSteps(value: string): boolean {
  if (!/^\d{5,}$/.test(value)) return false;
  const steps = [...value].slice(1).map((c, i) => (Number(c) - Number(value[i]) + 10) % 10);
  return steps.every((s) => s === steps[0]);
}

/** A PIN is weak when short, common, repeated or a simple run. */
export function weakPin(pin: string): boolean {
  const value = pin.trim().toLowerCase();
  if (value.length < 6) return true;
  return COMMON.has(value) || allSame(value) || runOfDigits(value) || evenSteps(value);
}

const GUESSABLE_WORDS = [
  'summit',
  'power',
  'event',
  'password',
  '2025',
  '2026',
  '2027',
  'tnb',
  'welcome',
];

/** An event code is weak when short, common, or made of obvious words and years. */
export function weakEventCode(code: string): boolean {
  const value = code.trim().toLowerCase();
  if (value.length < 10) return true;
  if (COMMON.has(value) || allSame(value)) return true;
  return GUESSABLE_WORDS.some((word) => value.includes(word));
}
