/**
 * SQLite implementation of DataAdapter, for local development.
 *
 * Counting and averaging happen in JavaScript rather than SQL. For an event
 * of about 80 people the whole table is a few kilobytes, so a clear loop
 * beats a clever query, and the same code will port to any other store.
 */
import type {
  AttendeeRepository,
  CheckInRepository,
  DataAdapter,
  FeedbackRepository,
  ImportRepository,
  LuckyDrawRepository,
  PhotoRepository,
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
  Setting,
} from '../types';
import { newCheckInToken, newId } from '@/lib/ids';
import { plainText } from '@/lib/text';

import { getPrismaClient } from './client';

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

export function createSqliteAdapter(): DataAdapter {
  const prisma = getPrismaClient();

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

    async search(query, limit = 20) {
      const clean = plainText(query, 80);
      if (clean.length < 2) return [];
      const rows = await prisma.attendee.findMany({
        where: {
          OR: [{ name: { contains: clean } }, { staffNo: { contains: clean } }],
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
          existing.isSecretariat === incoming.isSecretariat;

        if (unchanged) {
          result.unchanged += 1;
          continue;
        }

        await prisma.attendee.update({ where: { staffNo }, data: incoming });
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

  return {
    name: 'sqlite',

    async init() {
      // Fails loudly if prisma db push has not been run yet.
      await prisma.attendee.count();
    },

    async healthCheck() {
      try {
        const people = await prisma.attendee.count();
        return { ok: true, detail: `SQLite ready, ${people} attendees loaded` };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'unknown error';
        return {
          ok: false,
          detail: `SQLite not ready: ${message}. Try "npm run db:push".`,
        };
      }
    },

    async reset() {
      // Child rows first, so foreign keys stay happy.
      await prisma.luckyDrawWinner.deleteMany();
      await prisma.feedback.deleteMany();
      await prisma.checkIn.deleteMany();
      await prisma.attendee.deleteMany();
      await prisma.setting.deleteMany();
      await prisma.importedSheet.deleteMany();
      await prisma.photo.deleteMany();
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
  };
}
