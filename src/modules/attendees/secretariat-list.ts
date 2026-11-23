/**
 * The secretariat, marked by staff number on the Attendees page, for lists
 * that do not say "Secretariat" in a department, title or remark column.
 * Kept in the settings, so a new upload of the master list keeps them
 * marked. Pure helpers; see secretariat-list.test.ts.
 */
export const SECRETARIAT_KEY = 'attendees.secretariatStaffNos';

/** Staff numbers from pasted text: one per line, or separated by commas or spaces. */
export function parseStaffNos(text: string | null | undefined): string[] {
  const seen = new Set<string>();
  for (const part of (text ?? '').split(/[\s,;]+/)) {
    const value = part.trim().toUpperCase();
    if (value && value.length <= 32 && /^[A-Z0-9-]+$/.test(value)) seen.add(value);
  }
  return [...seen].slice(0, 500);
}

/** Who should be marked: those the list itself calls secretariat, and those named here. */
export function secretariatChanges(
  people: { id: string; staffNo: string; isSecretariat: boolean; byList: boolean }[],
  staffNos: string[],
): { mark: string[]; unmark: string[] } {
  const wanted = new Set(staffNos.map((s) => s.toUpperCase()));
  const mark: string[] = [];
  const unmark: string[] = [];
  for (const p of people) {
    const should = p.byList || wanted.has(p.staffNo.toUpperCase());
    if (should && !p.isSecretariat) mark.push(p.id);
    if (!should && p.isSecretariat) unmark.push(p.id);
  }
  return { mark, unmark };
}
