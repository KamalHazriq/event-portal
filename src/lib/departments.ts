/**
 * Department short names ("Corporate & Engineering Services" is CORES),
 * from the departments list in the event config. Shown on the big screen,
 * phones and admin pages; name tags say "Full name (SHORT)" and reports
 * keep both in two columns.
 *
 * Names are matched loosely (case, spaces, "and" for "&", Centre or
 * Center), so a slightly different spelling in the Excel still finds its
 * short name. A department not in the list shows in full and is flagged on
 * the secretariat home.
 */
import type { EventConfig } from './event-schema';

type WithDepartments = Pick<EventConfig, 'departments'>;

export function departmentKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/\band\b/g, '&')
    .replace(/\bcentre\b/g, 'center')
    .replace(/[^a-z0-9&]+/g, ' ')
    .trim();
}

type Entry = { name: string; short: string; division?: boolean };

/** By full name, and by the short name itself ("Cores" in an HR column is CORES). */
function lookup(config: WithDepartments): Map<string, Entry> {
  const map = new Map<string, Entry>();
  for (const d of config.departments) map.set(departmentKey(d.short), d);
  for (const d of config.departments) map.set(departmentKey(d.name), d);
  return map;
}

function findEntry(config: WithDepartments, name: string): Entry | null {
  if (!name.trim()) return null;
  return lookup(config).get(departmentKey(name)) ?? null;
}

/**
 * Whether this is the division over the departments rather than a
 * department: marked so in the list, or simply called a Division
 * ("Digital & Information Division").
 */
export function isDivision(config: WithDepartments, name: string): boolean {
  const entry = findEntry(config, name);
  if (entry?.division) return true;
  return /\bdivision\b/i.test(entry?.name ?? name);
}

/** The short name, or null when the department is not in the list. */
export function findShortName(config: WithDepartments, name: string): string | null {
  return findEntry(config, name)?.short ?? null;
}

/** For screens: the short name, else the name as written. */
export function shortDepartment(config: WithDepartments, name: string): string {
  return findShortName(config, name) ?? name;
}

/**
 * For name tags: "Corporate & Engineering Services (CORES)", with the full
 * name from the list even when the Excel only says "Cores".
 */
export function departmentWithShort(config: WithDepartments, name: string): string {
  const entry = findEntry(config, name);
  return entry ? `${entry.name} (${entry.short})` : name;
}

/** Departments on the attendee list that have no short name yet, once each. */
export function departmentsWithoutShortName(config: WithDepartments, names: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const name of names) {
    const key = departmentKey(name);
    if (!name.trim() || seen.has(key)) continue;
    seen.add(key);
    if (!findShortName(config, name)) out.push(name.trim());
  }
  return out.sort();
}

/**
 * The standard spelling for a department, used when the list is uploaded:
 * "Cores", "corporate and engineering services" and the full name all
 * become "Corporate & Engineering Services", so the headcount and the
 * leaderboard count them as one team. Unknown names are kept as written.
 */
export function canonicalDepartment(config: WithDepartments, name: string): string {
  return findEntry(config, name)?.name ?? name.trim();
}
