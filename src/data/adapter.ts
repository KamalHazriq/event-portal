/**
 * The one interface every storage back end implements.
 *
 * Brief hard rule 4: all reads and writes go through this. Components and
 * pages never import the database. Hosting is not decided yet, so the store
 * has to be swappable.
 *
 * Today there is one implementation, SQLite via Prisma, for local work. When
 * hosting is settled, a Supabase or SharePoint adapter is a new folder next
 * to src/data/sqlite that implements this same interface. No page changes.
 *
 * Scope note: this covers the modules that are confirmed and imminent, which
 * are check in (Module 4), feedback (Module 5), the admin console
 * (Module 6) and uploaded spreadsheets for the report (Module 7). Q&A, polls, the photo wall and the lucky draw each add their
 * own repository here when their module is built. They are left out on
 * purpose: Q&A and polls are backup only because the event runs on Slido, and
 * photo storage still needs a GRC answer, so their shape is not settled and
 * guessing it now would only create rework.
 */
import type {
  Attendee,
  AttendeeImportResult,
  AttendeeImportRow,
  CheckIn,
  CheckInMethod,
  CheckInWithAttendee,
  FeedbackEntry,
  FeedbackSummary,
  Headcount,
  ImportedSheet,
  ImportSource,
  Setting,
} from './types';

export interface AttendeeRepository {
  /** Everyone, ordered by the "no" column then name. */
  list(): Promise<Attendee[]>;
  get(id: string): Promise<Attendee | null>;
  /** Used by the QR scanner at the registration desk. */
  findByCheckInToken(token: string): Promise<Attendee | null>;
  findByStaffNo(staffNo: string): Promise<Attendee | null>;
  /** The manual fallback at the desk: match on part of a name or staff number. */
  search(query: string, limit?: number): Promise<Attendee[]>;
  count(): Promise<number>;
  /** The department list, for the headcount breakdown. */
  departments(): Promise<string[]>;
  /**
   * Loads the attendee CSV. Matches on staff number, so re-importing a
   * corrected file updates people instead of duplicating them, and existing
   * check in tokens survive (printed name tags keep working).
   */
  importRows(rows: AttendeeImportRow[]): Promise<AttendeeImportResult>;
}

export interface CheckInRepository {
  /**
   * Records an arrival. Checking in twice on the same day is not an error,
   * it returns the existing record, because at a busy desk a double scan
   * must not look like a failure.
   */
  create(input: {
    attendeeId: string;
    dayId: string;
    method: CheckInMethod;
    byOperator: string;
    /**
     * Only the demo seed passes this, so arrival times look like a real
     * morning rather than all landing in the same second. The desk never
     * sets it: a real arrival is recorded when it happens.
     */
    at?: string;
  }): Promise<{ checkIn: CheckIn; alreadyCheckedIn: boolean }>;
  /** Undo, for a scan of the wrong tag. */
  remove(attendeeId: string, dayId: string): Promise<boolean>;
  get(attendeeId: string, dayId: string): Promise<CheckIn | null>;
  listByDay(dayId: string): Promise<CheckInWithAttendee[]>;
  /** For the arrival wall on the big screen. Newest first. */
  recent(dayId: string, limit?: number): Promise<CheckInWithAttendee[]>;
  /** Who has not arrived yet, for the desk to chase. */
  listMissing(dayId: string): Promise<Attendee[]>;
  headcount(dayId: string): Promise<Headcount>;
}

export interface FeedbackRepository {
  /**
   * One submission per device per form. Returns duplicate: true instead of
   * throwing, so the page can say "thank you, already received".
   */
  submit(input: {
    formId: string;
    kind: FeedbackEntry['kind'];
    rating: number | null;
    answers: Record<string, string>;
    attendeeId: string | null;
    displayName: string;
    deviceId: string;
    /** Only the demo seed passes this. See checkIns.create. */
    at?: string;
  }): Promise<{ entry: FeedbackEntry | null; duplicate: boolean }>;
  hasSubmitted(formId: string, deviceId: string): Promise<boolean>;
  listByForm(formId: string): Promise<FeedbackEntry[]>;
  listAll(): Promise<FeedbackEntry[]>;
  summary(formId: string): Promise<FeedbackSummary>;
  /** Every form that has at least one response, for the admin overview. */
  summaries(): Promise<FeedbackSummary[]>;
}

export interface SettingsRepository {
  get(key: string): Promise<string | null>;
  getAll(): Promise<Setting[]>;
  set(key: string, value: string): Promise<Setting>;
  remove(key: string): Promise<boolean>;
}

/**
 * Spreadsheets uploaded by an admin, such as the Slido export after the
 * event. Uploading again replaces what is there, so a corrected file never
 * doubles up.
 */
export interface ImportRepository {
  replace(
    source: ImportSource,
    sheets: { kind: string; name: string; headers: string[]; rows: string[][] }[],
    meta: { fileName: string; byOperator: string },
  ): Promise<ImportedSheet[]>;
  /** In the order they appeared in the file. */
  list(source: ImportSource): Promise<ImportedSheet[]>;
  clear(source: ImportSource): Promise<number>;
}

export interface DataAdapter {
  /** Shown on the admin health page, so it is obvious which store is live. */
  readonly name: string;
  /** Opens the connection and checks the schema is present. */
  init(): Promise<void>;
  healthCheck(): Promise<{ ok: boolean; detail: string }>;
  /** Clears every table. Test and demo seeding only. */
  reset(): Promise<void>;
  close(): Promise<void>;

  readonly attendees: AttendeeRepository;
  readonly checkIns: CheckInRepository;
  readonly feedback: FeedbackRepository;
  readonly settings: SettingsRepository;
  readonly imports: ImportRepository;
}

/** The value of DATA_ADAPTER in .env.local. */
export const DATA_ADAPTERS = ['sqlite'] as const;
export type DataAdapterName = (typeof DATA_ADAPTERS)[number];
