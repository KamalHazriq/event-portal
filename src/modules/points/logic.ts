/**
 * Points and the leaderboard.
 *
 * Points are worked out from what people already do in the portal, not
 * stored as they happen. So nothing extra is written per action, an undone
 * check in or a rejected photo loses its points by itself, and someone who
 * signs in on their phone late still gets credit for what that phone did
 * before.
 *
 * A phone counts for a person once it is signed in as them (DeviceLink).
 * Check ins count without signing in, since the desk knows who arrived.
 *
 * Pure functions only, see logic.test.ts.
 */

export const POINTS = {
  /** Signing in on your phone, so the rest can count. */
  joined: 5,
  /** Arriving, per day. */
  checkIn: 10,
  /** Arriving before the day's first session starts. */
  onTime: 5,
  /** A feedback form sent, per form. */
  feedback: 5,
  /** A poll answered, per poll. */
  poll: 2,
  /** A photo the secretariat approved for the wall. */
  photo: 5,
  /** A question asked in the backup Q&A that was not hidden. */
  question: 3,
  /** Reacting during a talk, once per talk. */
  reaction: 1,
  /** A comment on a talk that the secretariat approved. */
  comment: 3,
} as const;

export type PointKind = keyof typeof POINTS;

/** Most that count, so nobody wins by uploading forty photos. */
export const CAPS: Partial<Record<PointKind, number>> = { photo: 4, question: 4, comment: 4 };

export const POINT_LABELS: Record<PointKind, string> = {
  joined: 'Signed in on your phone',
  checkIn: 'Arrived, each day',
  onTime: 'Arrived before the first session',
  feedback: 'Feedback form sent',
  poll: 'Poll answered',
  photo: 'Photo on the wall',
  question: 'Question asked',
  reaction: 'Reacted during a talk',
  comment: 'Comment on a talk shown',
};

export type ScorePerson = {
  id: string;
  name: string;
  department: string;
  isSecretariat: boolean;
};

export type ScoreSources = {
  links: { deviceId: string; attendeeId: string }[];
  checkIns: { attendeeId: string; dayId: string; at: string }[];
  /** When each day's first session starts, as an ISO instant. */
  dayStarts: Record<string, string | undefined>;
  feedback: { formId: string; deviceId: string; attendeeId: string | null }[];
  pollVotes: { pollId: string; deviceId: string }[];
  /** Approved photos only. */
  photos: { id: string; deviceId: string }[];
  /** Questions that were not hidden. */
  questions: { id: string; deviceId: string }[];
  /** Each phone that reacted in each talk, once. */
  reactions?: { sessionId: string; deviceId: string }[];
  /** Approved comments only. */
  comments?: { id: string; deviceId: string }[];
  /** Extra points the secretariat gave by hand. */
  bonus?: { attendeeId: string; points: number }[];
};

export type Score = {
  attendeeId: string;
  total: number;
  /** The part of the total the secretariat gave by hand. */
  bonus: number;
  /** How many of each, before multiplying by the points. */
  counts: Record<PointKind, number>;
};

function emptyCounts(): Record<PointKind, number> {
  return {
    joined: 0,
    checkIn: 0,
    onTime: 0,
    feedback: 0,
    poll: 0,
    photo: 0,
    question: 0,
    reaction: 0,
    comment: 0,
  };
}

export function computeScores(sources: ScoreSources): Map<string, Score> {
  const ownerOf = new Map(sources.links.map((l) => [l.deviceId, l.attendeeId]));
  // Distinct things per person and kind, so two phones answering the same
  // poll, or a form sent twice, count once.
  const seen = new Map<string, Map<PointKind, Set<string>>>();

  const add = (attendeeId: string | null | undefined, kind: PointKind, ref: string) => {
    if (!attendeeId) return;
    let kinds = seen.get(attendeeId);
    if (!kinds) {
      kinds = new Map();
      seen.set(attendeeId, kinds);
    }
    let refs = kinds.get(kind);
    if (!refs) {
      refs = new Set();
      kinds.set(kind, refs);
    }
    refs.add(ref);
  };

  for (const link of sources.links) add(link.attendeeId, 'joined', 'phone');

  for (const checkIn of sources.checkIns) {
    add(checkIn.attendeeId, 'checkIn', checkIn.dayId);
    const start = sources.dayStarts[checkIn.dayId];
    if (start && Date.parse(checkIn.at) < Date.parse(start)) {
      add(checkIn.attendeeId, 'onTime', checkIn.dayId);
    }
  }

  for (const entry of sources.feedback) {
    add(entry.attendeeId ?? ownerOf.get(entry.deviceId), 'feedback', entry.formId);
  }
  for (const vote of sources.pollVotes) add(ownerOf.get(vote.deviceId), 'poll', vote.pollId);
  for (const photo of sources.photos) add(ownerOf.get(photo.deviceId), 'photo', photo.id);
  for (const question of sources.questions) {
    add(ownerOf.get(question.deviceId), 'question', question.id);
  }
  for (const reaction of sources.reactions ?? []) {
    add(ownerOf.get(reaction.deviceId), 'reaction', reaction.sessionId);
  }
  for (const comment of sources.comments ?? []) {
    add(ownerOf.get(comment.deviceId), 'comment', comment.id);
  }

  const bonusOf = new Map<string, number>();
  for (const b of sources.bonus ?? []) {
    bonusOf.set(b.attendeeId, (bonusOf.get(b.attendeeId) ?? 0) + b.points);
  }

  const scores = new Map<string, Score>();
  // Someone with only a bonus still appears.
  for (const attendeeId of bonusOf.keys())
    if (!seen.has(attendeeId)) seen.set(attendeeId, new Map());
  for (const [attendeeId, kinds] of seen) {
    const counts = emptyCounts();
    let total = 0;
    for (const [kind, refs] of kinds) {
      const count = Math.min(refs.size, CAPS[kind] ?? Number.POSITIVE_INFINITY);
      counts[kind] = count;
      total += count * POINTS[kind];
    }
    const bonus = bonusOf.get(attendeeId) ?? 0;
    scores.set(attendeeId, { attendeeId, total: total + bonus, bonus, counts });
  }
  return scores;
}

export type PersonRow = {
  rank: number;
  attendeeId: string;
  name: string;
  department: string;
  points: number;
};

/**
 * Everyone with points, best first. Equal points share a rank ("1, 2, 2,
 * 4"). The secretariat are left out: they run the event.
 */
export function rankPeople(scores: Map<string, Score>, people: ScorePerson[]): PersonRow[] {
  const rows = people
    .filter((p) => !p.isSecretariat)
    .map((p) => ({ person: p, points: scores.get(p.id)?.total ?? 0 }))
    .filter((row) => row.points > 0)
    .sort((a, b) => b.points - a.points || a.person.name.localeCompare(b.person.name));

  let rank = 0;
  let previous = Number.NaN;
  return rows.map((row, index) => {
    if (row.points !== previous) rank = index + 1;
    previous = row.points;
    return {
      rank,
      attendeeId: row.person.id,
      name: row.person.name,
      department: row.person.department,
      points: row.points,
    };
  });
}

export type DepartmentRow = {
  rank: number;
  department: string;
  people: number;
  /** Average points per person on the list, so big teams do not win by size. */
  average: number;
  total: number;
};

/** Departments smaller than this are left off: one keen person is not a team. */
export const MIN_DEPARTMENT_SIZE = 3;

export function rankDepartments(
  scores: Map<string, Score>,
  people: ScorePerson[],
  minSize = MIN_DEPARTMENT_SIZE,
): DepartmentRow[] {
  const groups = new Map<string, { people: number; total: number }>();
  for (const person of people) {
    if (person.isSecretariat || !person.department) continue;
    const group = groups.get(person.department) ?? { people: 0, total: 0 };
    group.people += 1;
    group.total += scores.get(person.id)?.total ?? 0;
    groups.set(person.department, group);
  }

  const rows = [...groups.entries()]
    .filter(([, g]) => g.people >= minSize)
    .map(([department, g]) => ({
      department,
      people: g.people,
      total: g.total,
      average: Math.round((g.total / g.people) * 10) / 10,
    }))
    .sort((a, b) => b.average - a.average || a.department.localeCompare(b.department));

  let rank = 0;
  let previous = Number.NaN;
  return rows.map((row, index) => {
    if (row.average !== previous) rank = index + 1;
    previous = row.average;
    return { rank, ...row };
  });
}

/**
 * A shorter name for the projector when full names are hidden: the given
 * names, up to two words, before any "bin", "binti", "a/l" or "a/p".
 * "Aiman Hakim bin Mohd Rafi" becomes "Aiman Hakim".
 */
export function shortName(name: string): string {
  const words = name.trim().split(/\s+/);
  const stop = words.findIndex((w) => /^(bin|binti|bt|b\.|a\/l|a\/p|@)$/i.test(w));
  const given = (stop > 0 ? words.slice(0, stop) : words).slice(0, 2);
  return given.join(' ');
}

/**
 * The people whose name matches what was typed, for "pick your name".
 *
 * Each typed word of three letters or more must be the START of a word in
 * the name ("muh" finds Muhammad, "ham" does not). Few results, and short
 * words are ignored, so the list cannot be walked through two letters at a
 * time to read out every name.
 */
export function findByName<T extends { name: string }>(people: T[], typed: string, limit = 6): T[] {
  const words = typed
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length >= 3);
  if (words.length === 0) return [];
  return people
    .filter((p) => {
      const parts = p.name.toLowerCase().split(/[\s'-]+/);
      return words.every((word) => parts.some((part) => part.startsWith(word)));
    })
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, limit);
}

/* ------------------------------------------------------------------- bonus */

/** Where the by-hand bonus points are kept (a settings row holding a list). */
export const BONUS_KEY = 'points.bonus';
export const MAX_BONUS = 100;

export type BonusEntry = {
  id: string;
  attendeeId: string;
  points: number;
  reason: string;
  by: string;
  at: string;
};

export function parseBonus(raw: string | null): BonusEntry[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return value.filter(
      (v): v is BonusEntry =>
        typeof v === 'object' &&
        v !== null &&
        typeof (v as BonusEntry).id === 'string' &&
        typeof (v as BonusEntry).attendeeId === 'string' &&
        Number.isFinite((v as BonusEntry).points),
    );
  } catch {
    return [];
  }
}

/** A whole number from 1 to 100, or null. */
export function parseBonusPoints(value: unknown): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= MAX_BONUS ? n : null;
}

/* --------------------------------------------------------- early arrival */

/** Per day, the time before which arriving counts as early: {"day-1":"09:30"}. */
export const EARLY_KEY = 'points.earlyCutoffs';

export function parseEarlyCutoffs(raw: string | null): Record<string, string> {
  if (!raw) return {};
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null) return {};
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).filter(
        ([, v]) => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v),
      ),
    ) as Record<string, string>;
  } catch {
    return {};
  }
}
