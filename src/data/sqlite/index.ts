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
  Setting,
} from '../types';
import { newCheckInToken, newId } from '@/lib/ids';
import { plainText } from '@/lib/text';

import { getPrismaClient } from './client';

/* ------------------------------------------------------------ row mapping */

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
    async create({ attendeeId, dayId, method, byOperator }) {
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
      await prisma.feedback.deleteMany();
      await prisma.checkIn.deleteMany();
      await prisma.attendee.deleteMany();
      await prisma.setting.deleteMany();
    },

    async close() {
      await prisma.$disconnect();
    },

    attendees,
    checkIns,
    feedback,
    settings,
  };
}
