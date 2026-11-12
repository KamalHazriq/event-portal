/**
 * The DataAdapter, written once against Prisma and shared by both stores:
 * SQLite for local work and tests, Postgres (Neon) when hosted. The two
 * Prisma clients come from the same schema, so their query APIs match.
 *
 * Counting and averaging happen in JavaScript rather than SQL. For an event
 * of about 80 people the whole table is a few kilobytes, so a clear loop
 * beats a clever query, and the same code will port to any other store.
 */
import type { PrismaClient } from '@prisma/client';

import type {
  ActivityRepository,
  AttendeeRepository,
  CheckInRepository,
  DataAdapter,
  DataAdapterName,
  FeedbackRepository,
  ImportRepository,
  LuckyDrawRepository,
  PhotoRepository,
  PlayerRepository,
  PollRepository,
  QuestionRepository,
  SettingsRepository,
} from '../adapter';
import type {
  Attendee,
  AttendeeImportResult,
  CheckIn,
  CheckInWithAttendee,
  FeedbackEntry,
  FeedbackSummary,
  Headcount,
  ImportedSheet,
  ImportSource,
  LuckyDrawWinnerWithAttendee,
  Photo,
  PhotoStatus,
  Poll,
  PollKind,
  PollStatus,
  Question,
  QuestionStatus,
  Setting,
} from '../types';
import { newCheckInToken, newId } from '@/lib/ids';
import { plainText } from '@/lib/text';

/* ------------------------------------------------------------ row mapping */

/** Stored JSON back to text arrays, dropping anything that is not text. */
function parseStringArray(raw: string): string[] {
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value)
      ? value.map((v) => (typeof v === 'string' ? v : String(v ?? '')))
      : [];
  } catch {
    return [];
  }
}

function parseRows(raw: string): string[][] {
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return value.map((row) =>
      Array.isArray(row) ? row.map((v) => (typeof v === 'string' ? v : String(v ?? ''))) : [],
    );
  } catch {
    return [];
  }
}

type AttendeeRow = {
  id: string;
  no: number | null;
  staffNo: string;
  name: string;
  title: string;
  department: string;
  remark: string;
  email: string;
  checkInToken: string;
  isSecretariat: boolean;
  createdAt: Date;
  updatedAt: Date;
};

function toAttendee(row: AttendeeRow): Attendee {
  return {
    id: row.id,
    no: row.no,
    staffNo: row.staffNo,
    name: row.name,
    title: row.title,
    department: row.department,
    remark: row.remark,
    email: row.email,
    checkInToken: row.checkInToken,
    isSecretariat: row.isSecretariat,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

type CheckInRow = {
  id: string;
  attendeeId: string;
  dayId: string;
  at: Date;
  method: string;
  byOperator: string;
};

function toCheckIn(row: CheckInRow): CheckIn {
  const method = row.method === 'manual' || row.method === 'admin' ? row.method : 'qr';
  return {
    id: row.id,
    attendeeId: row.attendeeId,
    dayId: row.dayId,
    at: row.at.toISOString(),
    method,
    byOperator: row.byOperator,
  };
}

type FeedbackRow = {
  id: string;
  formId: string;
  kind: string;
  rating: number | null;
  answers: string;
  attendeeId: string | null;
  displayName: string;
  deviceId: string;
  at: Date;
};

/** SQLite has no JSON column, so answers are stored as a JSON string. */
function decodeAnswers(raw: string): Record<string, string> {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === 'string') out[key] = value;
    }
    return out;
  } catch {
    return {};
  }
}

function toFeedback(row: FeedbackRow): FeedbackEntry {
  return {
    id: row.id,
    formId: row.formId,
    kind: row.kind === 'event' ? 'event' : 'session',
    rating: row.rating,
    answers: decodeAnswers(row.answers),
    attendeeId: row.attendeeId,
    displayName: row.displayName,
    deviceId: row.deviceId,
    at: row.at.toISOString(),
  };
}

function isUniqueConflict(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  );
}

function emptyRatingCounts(): Record<1 | 2 | 3 | 4 | 5, number> {
  return { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
}

function summarise(formId: string, entries: FeedbackEntry[]): FeedbackSummary {
  const ratingCounts = emptyRatingCounts();
  let total = 0;
  let rated = 0;

  for (const entry of entries) {
    const rating = entry.rating;
    if (rating !== null && rating >= 1 && rating <= 5) {
      ratingCounts[rating as 1 | 2 | 3 | 4 | 5] += 1;
      total += rating;
      rated += 1;
    }
  }

  return {
    formId,
    responses: entries.length,
    averageRating: rated > 0 ? Math.round((total / rated) * 100) / 100 : null,
    ratingCounts,
  };
}

/* ------------------------------------------------------------- the adapter */

/** What differs between the stores. */
export type PrismaStoreOptions = {
  name: DataAdapterName;
  /** Shown on the dashboard's storage card. */
  label: string;
  /** What to try when the store cannot be reached. */
  notReadyHint: string;
  /**
   * SQLite's LIKE ignores case for plain letters by itself. Postgres needs
   * to be asked, or the desk search for "azlan" would miss "Azlan".
   */
  caseInsensitiveSearch: boolean;
};

export function createPrismaAdapter(
  prisma: PrismaClient,
  options: PrismaStoreOptions,
): DataAdapter {
  const textMatch = (value: string) =>
    options.caseInsensitiveSearch
      ? // The option is missing from the SQLite client's types only.
        ({ contains: value, mode: 'insensitive' } as unknown as { contains: string })
      : { contains: value };

  const attendees: AttendeeRepository = {
    async list() {
      const rows = await prisma.attendee.findMany({ orderBy: [{ no: 'asc' }, { name: 'asc' }] });
      return rows.map(toAttendee);
    },

    async get(id) {
      const row = await prisma.attendee.findUnique({ where: { id } });
      return row ? toAttendee(row) : null;
    },

    async findByCheckInToken(token) {
      const clean = token.trim();
      if (clean.length === 0) return null;
      const row = await prisma.attendee.findUnique({ where: { checkInToken: clean } });
      return row ? toAttendee(row) : null;
    },

    async findByStaffNo(staffNo) {
      const clean = staffNo.trim();
      if (clean.length === 0) return null;
      const row = await prisma.attendee.findUnique({ where: { staffNo: clean } });
      return row ? toAttendee(row) : null;
    },

    async rememberEmail(id, email) {
      const clean = email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean) || clean.length > 200) return;
      await prisma.attendee.updateMany({ where: { id, email: '' }, data: { email: clean } });
    },

    async search(query, limit = 20) {
      const clean = plainText(query, 80);
      if (clean.length < 2) return [];
      const rows = await prisma.attendee.findMany({
        where: {
          OR: [{ name: textMatch(clean) }, { staffNo: textMatch(clean) }],
        },
        orderBy: [{ name: 'asc' }],
        take: Math.min(Math.max(limit, 1), 100),
      });
      return rows.map(toAttendee);
    },

    async count() {
      return prisma.attendee.count();
    },

    async departments() {
      const rows = await prisma.attendee.findMany({
        distinct: ['department'],
        select: { department: true },
        orderBy: { department: 'asc' },
      });
      return rows.map((row) => row.department).filter((name) => name.length > 0);
    },

    async importRows(rows) {
      const result: AttendeeImportResult = {
        created: 0,
        updated: 0,
        unchanged: 0,
        skipped: [],
      };

      for (const [index, row] of rows.entries()) {
        // Row 1 is the header in the CSV, so report a line the user can find.
        const lineNumber = index + 2;
        const staffNo = plainText(row.staffNo, 40);
        const name = plainText(row.name, 120);

        if (staffNo.length === 0) {
          result.skipped.push({ row: lineNumber, reason: 'no staff_no' });
          continue;
        }
        if (name.length === 0) {
          result.skipped.push({ row: lineNumber, reason: 'no name' });
          continue;
        }

        const incoming = {
          no: row.no,
          name,
          title: plainText(row.title, 200),
          department: plainText(row.department, 120),
          remark: plainText(row.remark, 300),
          isSecretariat: row.isSecretariat ?? false,
        };
        // An empty email in the list keeps one learned from a card.
        const email = (row.email ?? '').trim().toLowerCase().slice(0, 200);

        const existing = await prisma.attendee.findUnique({ where: { staffNo } });

        if (!existing) {
          await prisma.attendee.create({
            data: {
              id: newId(),
              staffNo,
              // Generated once and kept, so a reprint is not needed when the
              // list is corrected and imported again.
              checkInToken: newCheckInToken(),
              ...incoming,
              email,
            },
          });
          result.created += 1;
          continue;
        }

        const unchanged =
          existing.no === incoming.no &&
          existing.name === incoming.name &&
          existing.title === incoming.title &&
          existing.department === incoming.department &&
          existing.remark === incoming.remark &&
          existing.isSecretariat === incoming.isSecretariat &&
          (email === '' || existing.email === email);

        if (unchanged) {
          result.unchanged += 1;
          continue;
        }

        await prisma.attendee.update({
          where: { staffNo },
          data: email ? { ...incoming, email } : incoming,
        });
        result.updated += 1;
      }

      return result;
    },
  };

  const checkIns: CheckInRepository = {
    async create({ attendeeId, dayId, method, byOperator, at }) {
      const existing = await prisma.checkIn.findUnique({
        where: { attendeeId_dayId: { attendeeId, dayId } },
      });
      if (existing) {
        return { checkIn: toCheckIn(existing), alreadyCheckedIn: true };
      }

      try {
        const created = await prisma.checkIn.create({
          data: {
            id: newId(),
            attendeeId,
            dayId,
            method,
            byOperator: plainText(byOperator, 40),
            ...(at ? { at: new Date(at) } : {}),
          },
        });
        return { checkIn: toCheckIn(created), alreadyCheckedIn: false };
      } catch (error) {
        // Two desks scanned the same tag at the same moment. Not an error.
        if (isUniqueConflict(error)) {
          const row = await prisma.checkIn.findUnique({
            where: { attendeeId_dayId: { attendeeId, dayId } },
          });
          if (row) return { checkIn: toCheckIn(row), alreadyCheckedIn: true };
        }
        throw error;
      }
    },

    async remove(attendeeId, dayId) {
      const deleted = await prisma.checkIn.deleteMany({ where: { attendeeId, dayId } });
      return deleted.count > 0;
    },

    async get(attendeeId, dayId) {
      const row = await prisma.checkIn.findUnique({
        where: { attendeeId_dayId: { attendeeId, dayId } },
      });
      return row ? toCheckIn(row) : null;
    },

    async listByDay(dayId) {
      const rows = await prisma.checkIn.findMany({
        where: { dayId },
        include: { attendee: true },
        orderBy: { at: 'asc' },
      });
      return rows.map((row) => ({
        ...toCheckIn(row),
        attendee: toAttendee(row.attendee),
      })) satisfies CheckInWithAttendee[];
    },

    async recent(dayId, limit = 10) {
      const rows = await prisma.checkIn.findMany({
        where: { dayId },
        include: { attendee: true },
        orderBy: { at: 'desc' },
        take: Math.min(Math.max(limit, 1), 100),
      });
      return rows.map((row) => ({ ...toCheckIn(row), attendee: toAttendee(row.attendee) }));
    },

    async listMissing(dayId) {
      const rows = await prisma.attendee.findMany({
        where: { checkIns: { none: { dayId } } },
        orderBy: [{ department: 'asc' }, { name: 'asc' }],
      });
      return rows.map(toAttendee);
    },

    async headcount(dayId) {
      const [people, arrivals] = await Promise.all([
        prisma.attendee.findMany({ select: { id: true, department: true } }),
        prisma.checkIn.findMany({ where: { dayId }, select: { attendeeId: true } }),
      ]);

      const arrivedIds = new Set(arrivals.map((row) => row.attendeeId));
      const byDepartment = new Map<string, { expected: number; arrived: number }>();

      for (const person of people) {
        const key = person.department.length > 0 ? person.department : 'Not stated';
        const bucket = byDepartment.get(key) ?? { expected: 0, arrived: 0 };
        bucket.expected += 1;
        if (arrivedIds.has(person.id)) bucket.arrived += 1;
        byDepartment.set(key, bucket);
      }

      return {
        dayId,
        expected: people.length,
        arrived: arrivedIds.size,
        byDepartment: [...byDepartment.entries()]
          .map(([department, counts]) => ({ department, ...counts }))
          .sort((a, b) => a.department.localeCompare(b.department)),
      } satisfies Headcount;
    },
  };

  const feedback: FeedbackRepository = {
    async submit(input) {
      try {
        const created = await prisma.feedback.create({
          data: {
            id: newId(),
            formId: input.formId,
            kind: input.kind,
            rating: input.rating,
            answers: JSON.stringify(input.answers),
            attendeeId: input.attendeeId,
            displayName: plainText(input.displayName, 120),
            deviceId: input.deviceId,
            ...(input.at ? { at: new Date(input.at) } : {}),
          },
        });
        return { entry: toFeedback(created), duplicate: false };
      } catch (error) {
        if (isUniqueConflict(error)) return { entry: null, duplicate: true };
        throw error;
      }
    },

    async hasSubmitted(formId, deviceId) {
      const row = await prisma.feedback.findUnique({
        where: { formId_deviceId: { formId, deviceId } },
        select: { id: true },
      });
      return row !== null;
    },

    async listByForm(formId) {
      const rows = await prisma.feedback.findMany({ where: { formId }, orderBy: { at: 'asc' } });
      return rows.map(toFeedback);
    },

    async listAll() {
      const rows = await prisma.feedback.findMany({ orderBy: { at: 'asc' } });
      return rows.map(toFeedback);
    },

    async summary(formId) {
      const entries = await this.listByForm(formId);
      return summarise(formId, entries);
    },

    async summaries() {
      const entries = await this.listAll();
      const grouped = new Map<string, FeedbackEntry[]>();
      for (const entry of entries) {
        const bucket = grouped.get(entry.formId) ?? [];
        bucket.push(entry);
        grouped.set(entry.formId, bucket);
      }
      return [...grouped.entries()]
        .map(([formId, list]) => summarise(formId, list))
        .sort((a, b) => a.formId.localeCompare(b.formId));
    },
  };

  const settings: SettingsRepository = {
    async get(key) {
      const row = await prisma.setting.findUnique({ where: { key } });
      return row?.value ?? null;
    },

    async getAll() {
      const rows = await prisma.setting.findMany({ orderBy: { key: 'asc' } });
      return rows.map((row): Setting => ({
        key: row.key,
        value: row.value,
        updatedAt: row.updatedAt.toISOString(),
      }));
    },

    async set(key, value) {
      const row = await prisma.setting.upsert({
        where: { key },
        create: { key, value },
        update: { value },
      });
      return { key: row.key, value: row.value, updatedAt: row.updatedAt.toISOString() };
    },

    async remove(key) {
      const deleted = await prisma.setting.deleteMany({ where: { key } });
      return deleted.count > 0;
    },
  };

  const imports: ImportRepository = {
    async replace(source, sheets, meta) {
      const fileName = plainText(meta.fileName, 200);
      const byOperator = plainText(meta.byOperator, 40);
      // One transaction, so a failed upload never leaves half a file behind.
      await prisma.$transaction([
        prisma.importedSheet.deleteMany({ where: { source } }),
        ...sheets.map((sheet, position) =>
          prisma.importedSheet.create({
            data: {
              id: newId(),
              source,
              kind: sheet.kind,
              name: sheet.name,
              headers: JSON.stringify(sheet.headers),
              rows: JSON.stringify(sheet.rows),
              fileName,
              byOperator,
              position,
            },
          }),
        ),
      ]);
      return imports.list(source);
    },

    async list(source) {
      const rows = await prisma.importedSheet.findMany({
        where: { source },
        orderBy: { position: 'asc' },
      });
      return rows.map((row): ImportedSheet => ({
        id: row.id,
        source: row.source as ImportSource,
        kind: row.kind,
        name: row.name,
        headers: parseStringArray(row.headers),
        rows: parseRows(row.rows),
        fileName: row.fileName,
        byOperator: row.byOperator,
        importedAt: row.importedAt.toISOString(),
      }));
    },

    async clear(source) {
      const deleted = await prisma.importedSheet.deleteMany({ where: { source } });
      return deleted.count;
    },
  };

  const luckyDraw: LuckyDrawRepository = {
    async list() {
      const rows = await prisma.luckyDrawWinner.findMany({
        include: { attendee: true },
        // Ids are time ordered by when they were written. See groupDraws.
        orderBy: { id: 'asc' },
      });
      return rows.map((row): LuckyDrawWinnerWithAttendee => ({
        id: row.id,
        drawId: row.drawId,
        position: row.position,
        prize: row.prize,
        attendeeId: row.attendeeId,
        drawnAt: row.drawnAt.toISOString(),
        byOperator: row.byOperator,
        attendee: toAttendee(row.attendee),
      }));
    },

    async record(input) {
      const prize = plainText(input.prize, 80);
      const byOperator = plainText(input.byOperator, 40);
      const drawnAt = input.at ? new Date(input.at) : new Date();
      try {
        // One transaction: the unique attendeeId makes a double win fail the
        // whole draw rather than half of it.
        await prisma.$transaction(
          input.attendeeIds.map((attendeeId, i) =>
            prisma.luckyDrawWinner.create({
              data: {
                id: newId(),
                drawId: input.drawId,
                position: i + 1,
                prize,
                attendeeId,
                drawnAt,
                byOperator,
              },
            }),
          ),
        );
      } catch (error) {
        const code = (error as { code?: unknown }).code;
        if (code === 'P2002') return { ok: false };
        throw error;
      }
      const all = await luckyDraw.list();
      return { ok: true, winners: all.filter((w) => w.drawId === input.drawId) };
    },

    async remove(winnerId) {
      const deleted = await prisma.luckyDrawWinner.deleteMany({ where: { id: winnerId } });
      return deleted.count > 0;
    },

    async clear() {
      const deleted = await prisma.luckyDrawWinner.deleteMany();
      return deleted.count;
    },
  };

  const PHOTO_FIELDS = {
    id: true,
    deviceId: true,
    caption: true,
    status: true,
    width: true,
    height: true,
    sizeBytes: true,
    createdAt: true,
    reviewedAt: true,
    reviewedBy: true,
  } as const;

  type PhotoRow = {
    id: string;
    deviceId: string;
    caption: string;
    status: string;
    width: number;
    height: number;
    sizeBytes: number;
    createdAt: Date;
    reviewedAt: Date | null;
    reviewedBy: string;
  };

  const toPhoto = (row: PhotoRow): Photo => ({
    id: row.id,
    deviceId: row.deviceId,
    caption: row.caption,
    status: (['pending', 'approved', 'rejected'].includes(row.status)
      ? row.status
      : 'pending') as PhotoStatus,
    width: row.width,
    height: row.height,
    sizeBytes: row.sizeBytes,
    createdAt: row.createdAt.toISOString(),
    reviewedAt: row.reviewedAt ? row.reviewedAt.toISOString() : null,
    reviewedBy: row.reviewedBy,
  });

  const photos: PhotoRepository = {
    async add(input) {
      const row = await prisma.photo.create({
        data: {
          id: newId(),
          deviceId: input.deviceId,
          caption: plainText(input.caption, 120),
          width: input.width,
          height: input.height,
          sizeBytes: input.image.byteLength,
          image: Buffer.from(input.image),
          thumbnail: Buffer.from(input.thumbnail),
          createdAt: input.at ? new Date(input.at) : new Date(),
        },
        select: PHOTO_FIELDS,
      });
      return toPhoto(row);
    },

    async list(status) {
      const rows = await prisma.photo.findMany({
        where: status ? { status } : {},
        orderBy: { createdAt: 'desc' },
        select: PHOTO_FIELDS,
      });
      return rows.map(toPhoto);
    },

    async countByDevice(deviceId) {
      return prisma.photo.count({ where: { deviceId } });
    },

    async image(id, size) {
      const row = await prisma.photo.findUnique({
        where: { id },
        select: { ...PHOTO_FIELDS, image: size === 'full', thumbnail: size === 'thumb' },
      });
      if (!row) return null;
      const bytes = size === 'full' ? row.image : row.thumbnail;
      if (!bytes) return null;
      return { photo: toPhoto(row), bytes: new Uint8Array(bytes) };
    },

    async setStatus(ids, status, byOperator) {
      if (ids.length === 0) return 0;
      const updated = await prisma.photo.updateMany({
        where: { id: { in: ids } },
        data: { status, reviewedAt: new Date(), reviewedBy: plainText(byOperator, 40) },
      });
      return updated.count;
    },

    async remove(id) {
      const deleted = await prisma.photo.deleteMany({ where: { id } });
      return deleted.count > 0;
    },
  };

  /* -------------------------------------------------- the secretariat */

  const activity: ActivityRepository = {
    async log(operator, action) {
      await prisma.adminActivity.create({
        data: { id: newId(), operator: plainText(operator, 40), action: plainText(action, 160) },
      });
    },

    async recent(limit = 50) {
      const rows = await prisma.adminActivity.findMany({ orderBy: { id: 'desc' }, take: limit });
      return rows.map((r) => ({
        id: r.id,
        operator: r.operator,
        action: r.action,
        at: r.at.toISOString(),
      }));
    },

    async touch(operator, page) {
      const label = plainText(operator, 40);
      const where = plainText(page, 120);
      await prisma.adminPresence.upsert({
        where: { operator: label },
        create: { operator: label, page: where },
        update: { page: where, lastSeenAt: new Date() },
      });
    },

    async seenSince(sinceIso) {
      const rows = await prisma.adminPresence.findMany({
        where: { lastSeenAt: { gte: new Date(sinceIso) } },
        orderBy: { lastSeenAt: 'desc' },
      });
      return rows.map((r) => ({
        operator: r.operator,
        page: r.page,
        lastSeenAt: r.lastSeenAt.toISOString(),
      }));
    },
  };

  /* ---------------------------------------------------- Q&A and polls */

  const isUniqueClash = (error: unknown) => (error as { code?: unknown }).code === 'P2002';

  type QuestionRow = {
    id: string;
    sessionId: string;
    text: string;
    name: string;
    deviceId: string;
    status: string;
    pinned: boolean;
    createdAt: Date;
    _count?: { votes: number };
  };

  const toQuestion = (row: QuestionRow): Question => ({
    id: row.id,
    sessionId: row.sessionId,
    text: row.text,
    name: row.name,
    deviceId: row.deviceId,
    status: (['pending', 'approved', 'answered', 'hidden'].includes(row.status)
      ? row.status
      : 'pending') as QuestionStatus,
    pinned: row.pinned,
    votes: row._count?.votes ?? 0,
    createdAt: row.createdAt.toISOString(),
  });

  const questions: QuestionRepository = {
    async add(input) {
      const row = await prisma.question.create({
        data: {
          id: newId(),
          sessionId: input.sessionId,
          text: input.text,
          name: input.name,
          deviceId: input.deviceId,
          status: input.status,
          createdAt: input.at ? new Date(input.at) : new Date(),
        },
      });
      return toQuestion(row);
    },

    async listBySession(sessionId) {
      const rows = await prisma.question.findMany({
        where: { sessionId },
        orderBy: { id: 'asc' },
        include: { _count: { select: { votes: true } } },
      });
      return rows.map(toQuestion);
    },

    async countByDevice(sessionId, deviceId) {
      return prisma.question.count({ where: { sessionId, deviceId } });
    },

    async setStatus(id, status) {
      const updated = await prisma.question.updateMany({
        where: { id },
        // A question that leaves the screen cannot stay pinned to it.
        data: status === 'approved' ? { status } : { status, pinned: false },
      });
      return updated.count > 0;
    },

    async setPinned(id, pinned) {
      const row = await prisma.question.findUnique({ where: { id } });
      if (!row) return false;
      await prisma.$transaction([
        prisma.question.updateMany({
          where: { sessionId: row.sessionId, pinned: true },
          data: { pinned: false },
        }),
        prisma.question.update({ where: { id }, data: { pinned } }),
      ]);
      return true;
    },

    async vote(questionId, deviceId) {
      try {
        await prisma.questionVote.create({ data: { questionId, deviceId } });
        return true;
      } catch (error) {
        if (isUniqueClash(error)) return false;
        throw error;
      }
    },

    async votedIds(sessionId, deviceId) {
      const rows = await prisma.questionVote.findMany({
        where: { deviceId, question: { sessionId } },
        select: { questionId: true },
      });
      return rows.map((r) => r.questionId);
    },

    async remove(id) {
      const deleted = await prisma.question.deleteMany({ where: { id } });
      return deleted.count > 0;
    },
  };

  type PollRow = {
    id: string;
    question: string;
    kind: string;
    options: string;
    status: string;
    revealed: boolean;
    position: number;
    createdAt: Date;
  };

  const toPoll = (row: PollRow): Poll => ({
    id: row.id,
    question: row.question,
    kind: (['single', 'multiple', 'wordcloud'].includes(row.kind)
      ? row.kind
      : 'single') as PollKind,
    options: parseStringArray(row.options),
    status: (['draft', 'open', 'closed'].includes(row.status) ? row.status : 'draft') as PollStatus,
    revealed: row.revealed,
    position: row.position,
    createdAt: row.createdAt.toISOString(),
  });

  const polls: PollRepository = {
    async list() {
      const rows = await prisma.poll.findMany({ orderBy: [{ position: 'asc' }, { id: 'asc' }] });
      return rows.map(toPoll);
    },

    async get(id) {
      const row = await prisma.poll.findUnique({ where: { id } });
      return row ? toPoll(row) : null;
    },

    async create(input) {
      const last = await prisma.poll.findFirst({ orderBy: { position: 'desc' } });
      const row = await prisma.poll.create({
        data: {
          id: input.id ?? newId(),
          question: input.question,
          kind: input.kind,
          options: JSON.stringify(input.options),
          position: (last?.position ?? 0) + 1,
        },
      });
      return toPoll(row);
    },

    async setStatus(id, status) {
      if (status === 'open') {
        await prisma.$transaction([
          prisma.poll.updateMany({
            where: { status: 'open', NOT: { id } },
            data: { status: 'closed' },
          }),
          prisma.poll.updateMany({ where: { id }, data: { status } }),
        ]);
        return true;
      }
      const updated = await prisma.poll.updateMany({ where: { id }, data: { status } });
      return updated.count > 0;
    },

    async setRevealed(id, revealed) {
      const updated = await prisma.poll.updateMany({ where: { id }, data: { revealed } });
      return updated.count > 0;
    },

    async remove(id) {
      const deleted = await prisma.poll.deleteMany({ where: { id } });
      return deleted.count > 0;
    },

    async vote(pollId, deviceId, choices) {
      try {
        await prisma.pollVote.create({
          data: { pollId, deviceId, choices: JSON.stringify(choices) },
        });
        return { duplicate: false };
      } catch (error) {
        if (isUniqueClash(error)) return { duplicate: true };
        throw error;
      }
    },

    async hasVoted(pollId, deviceId) {
      const row = await prisma.pollVote.findUnique({
        where: { pollId_deviceId: { pollId, deviceId } },
      });
      return row !== null;
    },

    async votes(pollId) {
      const rows = await prisma.pollVote.findMany({ where: { pollId } });
      return rows.map((r) => ({
        pollId: r.pollId,
        deviceId: r.deviceId,
        choices: parseStringArray(r.choices),
        at: r.at.toISOString(),
      }));
    },
  };

  const players: PlayerRepository = {
    async link(deviceId, attendeeId) {
      await prisma.deviceLink.upsert({
        where: { deviceId },
        create: { deviceId, attendeeId },
        update: { attendeeId, linkedAt: new Date() },
      });
    },

    async unlink(deviceId) {
      await prisma.deviceLink.deleteMany({ where: { deviceId } });
    },

    async ownerOf(deviceId) {
      const row = await prisma.deviceLink.findUnique({ where: { deviceId } });
      return row?.attendeeId ?? null;
    },

    async links() {
      const rows = await prisma.deviceLink.findMany();
      return rows.map((row) => ({
        deviceId: row.deviceId,
        attendeeId: row.attendeeId,
        linkedAt: row.linkedAt.toISOString(),
      }));
    },
  };

  return {
    name: options.name,

    async init() {
      // Fails loudly if the tables do not exist yet.
      await prisma.attendee.count();
    },

    async healthCheck() {
      try {
        const people = await prisma.attendee.count();
        return { ok: true, detail: `${options.label} ready, ${people} attendees loaded` };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'unknown error';
        return {
          ok: false,
          detail: `${options.label} not ready: ${message}. ${options.notReadyHint}`,
        };
      }
    },

    async reset() {
      // Child rows first, so foreign keys stay happy.
      await prisma.deviceLink.deleteMany();
      await prisma.luckyDrawWinner.deleteMany();
      await prisma.feedback.deleteMany();
      await prisma.checkIn.deleteMany();
      await prisma.attendee.deleteMany();
      await prisma.setting.deleteMany();
      await prisma.importedSheet.deleteMany();
      await prisma.photo.deleteMany();
      await prisma.questionVote.deleteMany();
      await prisma.question.deleteMany();
      await prisma.pollVote.deleteMany();
      await prisma.poll.deleteMany();
      await prisma.adminActivity.deleteMany();
      await prisma.adminPresence.deleteMany();
    },

    async close() {
      await prisma.$disconnect();
    },

    attendees,
    checkIns,
    feedback,
    settings,
    imports,
    luckyDraw,
    photos,
    questions,
    polls,
    activity,
    players,
  };
}
