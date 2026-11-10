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
 * (Module 6) and uploaded spreadsheets for the report (Module 7). Everything in the brief now has its repository here. They are left out on
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
  LuckyDrawWinnerWithAttendee,
  Photo,
  PhotoStatus,
  Poll,
  PollKind,
  PollStatus,
  PollVote,
  Question,
  QuestionStatus,
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

/** Lucky draw winners. The store itself refuses anyone who has already won. */
export interface LuckyDrawRepository {
  /** Every winner, in the order they were written: draw by draw, by position. */
  list(): Promise<LuckyDrawWinnerWithAttendee[]>;
  /**
   * Saves one draw. All or nothing: if any of these people has already won
   * (another desk drew them a moment ago), nothing is saved and the answer
   * says so, so the caller can draw again from a fresh pool.
   */
  record(input: {
    drawId: string;
    prize: string;
    byOperator: string;
    attendeeIds: string[];
    /** Only the demo seed passes this. See checkIns.create. */
    at?: string;
  }): Promise<{ ok: true; winners: LuckyDrawWinnerWithAttendee[] } | { ok: false }>;
  /** Takes one winner off the list, for someone who was not in the room. */
  remove(winnerId: string): Promise<boolean>;
  /** Every winner gone, for a rehearsal. */
  clear(): Promise<number>;
}

/**
 * The photo wall. Images are stored through here (today in SQLite), so they
 * can move to approved storage later without any page changing.
 */
export interface PhotoRepository {
  /** Saves a new photo, waiting for approval. */
  add(input: {
    deviceId: string;
    caption: string;
    width: number;
    height: number;
    image: Uint8Array;
    thumbnail: Uint8Array;
    /** Only the demo seed passes this. See checkIns.create. */
    at?: string;
  }): Promise<Photo>;
  /** Newest first. Never includes the image bytes. */
  list(status?: PhotoStatus): Promise<Photo[]>;
  countByDevice(deviceId: string): Promise<number>;
  /** The JPEG bytes, full size or the small thumbnail. */
  image(id: string, size: 'full' | 'thumb'): Promise<{ photo: Photo; bytes: Uint8Array } | null>;
  setStatus(ids: string[], status: PhotoStatus, byOperator: string): Promise<number>;
  remove(id: string): Promise<boolean>;
}

/** The backup Q&A (Module 2). */
export interface QuestionRepository {
  add(input: {
    sessionId: string;
    text: string;
    name: string;
    deviceId: string;
    status: QuestionStatus;
    /** Only the demo seed passes this. See checkIns.create. */
    at?: string;
  }): Promise<Question>;
  /** Every question for a session, any status, oldest first, with vote counts. */
  listBySession(sessionId: string): Promise<Question[]>;
  /** For the per phone limit. */
  countByDevice(sessionId: string, deviceId: string): Promise<number>;
  setStatus(id: string, status: QuestionStatus): Promise<boolean>;
  /** Pinning one question unpins any other in the same session. */
  setPinned(id: string, pinned: boolean): Promise<boolean>;
  /** One vote per phone per question. False if this phone already voted. */
  vote(questionId: string, deviceId: string): Promise<boolean>;
  /** Which of a session's questions this phone has voted for. */
  votedIds(sessionId: string, deviceId: string): Promise<string[]>;
  remove(id: string): Promise<boolean>;
}

/** The backup polls (Module 3). */
export interface PollRepository {
  /** In display order. */
  list(): Promise<Poll[]>;
  get(id: string): Promise<Poll | null>;
  create(input: {
    id?: string;
    question: string;
    kind: PollKind;
    options: string[];
  }): Promise<Poll>;
  /** Opening a poll closes whichever was open: one poll at a time. */
  setStatus(id: string, status: PollStatus): Promise<boolean>;
  setRevealed(id: string, revealed: boolean): Promise<boolean>;
  remove(id: string): Promise<boolean>;
  /** One answer per phone per poll. duplicate is true if it already answered. */
  vote(pollId: string, deviceId: string, choices: string[]): Promise<{ duplicate: boolean }>;
  hasVoted(pollId: string, deviceId: string): Promise<boolean>;
  votes(pollId: string): Promise<PollVote[]>;
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
  readonly luckyDraw: LuckyDrawRepository;
  readonly photos: PhotoRepository;
  readonly questions: QuestionRepository;
  readonly polls: PollRepository;
}

/** The value of DATA_ADAPTER in .env.local. */
export const DATA_ADAPTERS = ['sqlite'] as const;
export type DataAdapterName = (typeof DATA_ADAPTERS)[number];
