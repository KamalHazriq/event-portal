/**
 * Writes config/attendees.sample.csv.
 *
 * Brief hard rule 2: no real personal data in the repo. Every person below is
 * invented by combining name parts at random. The random generator is seeded,
 * so running this twice produces the same file and git shows no noise.
 *
 * Run it with: npm run attendees:generate
 *
 * The real list goes in config/attendees.csv, which is git-ignored.
 *
 * Counts follow the brief: 78 attendees plus 12 secretariat, so 90 rows.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ATTENDEE_COUNT = 78;
const SECRETARIAT_COUNT = 12;
const OUTPUT = join(process.cwd(), 'config', 'attendees.sample.csv');

/** Small seeded generator, so the output never changes between runs. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST_NAMES = [
  'Aisyah',
  'Arif',
  'Azman',
  'Bella',
  'Chong',
  'Daniel',
  'Devi',
  'Faizal',
  'Farah',
  'Gopal',
  'Hafiz',
  'Hani',
  'Ida',
  'Imran',
  'Ismail',
  'Jaya',
  'Kamala',
  'Khairul',
  'Lailatul',
  'Lim',
  'Maria',
  'Mei Ling',
  'Nadia',
  'Nizam',
  'Noraini',
  'Omar',
  'Pavithra',
  'Rahim',
  'Ramesh',
  'Rina',
  'Rosman',
  'Sabrina',
  'Salleh',
  'Shanti',
  'Siti',
  'Suhaimi',
  'Tan',
  'Thomas',
  'Vijay',
  'Wan',
  'Yusof',
  'Zaki',
  'Zarina',
  'Zulkifli',
];

const LAST_NAMES = [
  'Abdullah',
  'Ahmad',
  'Ariffin',
  'Baskaran',
  'Chandran',
  'Chin',
  'Daud',
  'Fernandez',
  'Ghani',
  'Hashim',
  'Ibrahim',
  'Jalil',
  'Kamaruddin',
  'Krishnan',
  'Lai',
  'Mahmud',
  'Mansor',
  'Musa',
  'Nathan',
  'Ng',
  'Osman',
  'Rahman',
  'Raju',
  'Samad',
  'Shariff',
  'Sulaiman',
  'Tai',
  'Veerasamy',
  'Wong',
  'Yahya',
  'Yap',
  'Zainal',
];

/**
 * The departments from the real participant list, and roughly how many
 * people each has in it, so the demo headcount looks like the real one. Only
 * department names here: the people are invented.
 */
const DEPARTMENT_COUNTS: [string, number][] = [
  ['TNS', 13],
  ['CSM', 9],
  ['CS', 8],
  ['DAX', 7],
  ['EOTF', 7],
  ['CDOS', 5],
  ['TA', 5],
  ['GRC', 5],
  ['ERP', 4],
  ['ECS', 4],
  ['Cores', 4],
  ['SPTx', 3],
  ['IO', 3],
  ['CDIO', 1],
];

/** The titles from the real list, in about the same mix. */
const TITLE_COUNTS: [string, number][] = [
  ['Lead', 45],
  ['Head', 15],
  ['Team Lead', 9],
  ['Technical Expert', 5],
  ['Senior Manager', 2],
  ['SGM', 2],
];

/** The secretariat are the SPTx team, so they need no department of their own. */
const SECRETARIAT_DEPARTMENT = 'SPTx';

const SECRETARIAT_TITLES = ['Secretariat', 'Floor Manager', 'Registration Desk', 'Logistics'];

const REMARKS = [
  '',
  '',
  '',
  '',
  'Vegetarian meal',
  'Halal meal',
  'Wheelchair access',
  'Joining Day 2 only',
];

type Row = {
  no: number;
  staffNo: string;
  name: string;
  title: string;
  department: string;
  remark: string;
};

/** Every value repeated its count, then shuffled with the seeded generator. */
function shuffledPool(random: () => number, counts: [string, number][]): string[] {
  const pool = counts.flatMap(([value, count]) => Array.from({ length: count }, () => value));
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j] as string, pool[i] as string];
  }
  return pool;
}

function pick<T>(random: () => number, list: readonly T[]): T {
  const index = Math.floor(random() * list.length);
  return list[Math.min(index, list.length - 1)] as T;
}

/** Wraps a value in quotes only when it needs them, and escapes any quotes. */
function csvCell(value: string): string {
  if (/[",\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function build(): Row[] {
  const random = mulberry32(20261214);
  const rows: Row[] = [];
  const usedNames = new Set<string>();

  const makeName = (): string => {
    for (let attempt = 0; attempt < 200; attempt += 1) {
      const name = `${pick(random, FIRST_NAMES)} ${pick(random, LAST_NAMES)}`;
      if (!usedNames.has(name)) {
        usedNames.add(name);
        return name;
      }
    }
    // Every combination somehow taken. Fall back to a numbered name.
    const fallback = `Attendee ${usedNames.size + 1}`;
    usedNames.add(fallback);
    return fallback;
  };

  const departments = shuffledPool(random, DEPARTMENT_COUNTS);
  const titles = shuffledPool(random, TITLE_COUNTS);

  for (let i = 0; i < ATTENDEE_COUNT; i += 1) {
    rows.push({
      no: rows.length + 1,
      staffNo: `D${String(10_001 + i)}`,
      name: makeName(),
      title: titles[i % titles.length] as string,
      department: departments[i % departments.length] as string,
      remark: pick(random, REMARKS),
    });
  }

  for (let i = 0; i < SECRETARIAT_COUNT; i += 1) {
    rows.push({
      no: rows.length + 1,
      staffNo: `S${String(90_001 + i)}`,
      name: makeName(),
      title: pick(random, SECRETARIAT_TITLES),
      department: SECRETARIAT_DEPARTMENT,
      // The importer reads this word to flag secretariat, who are excluded
      // from the lucky draw by default.
      remark: 'Secretariat',
    });
  }

  return rows;
}

function main(): void {
  const rows = build();
  const header = 'no,staff_no,name,title,department,remark';
  const lines = rows.map((row) =>
    [
      String(row.no),
      row.staffNo,
      csvCell(row.name),
      csvCell(row.title),
      csvCell(row.department),
      csvCell(row.remark),
    ].join(','),
  );

  writeFileSync(OUTPUT, `${[header, ...lines].join('\n')}\n`, 'utf8');

  const secretariat = rows.filter((row) => row.remark === 'Secretariat').length;
  console.log(`Wrote ${rows.length} rows to config/attendees.sample.csv`);
  console.log(`  attendees:   ${rows.length - secretariat}`);
  console.log(`  secretariat: ${secretariat}`);
  console.log('All names are invented. No real personal data is in this file.');
}

main();
