/**
 * The data the portal stores.
 *
 * These types are storage neutral on purpose. They say nothing about SQLite,
 * Supabase or SharePoint, so swapping the store later is a new file in
 * src/data/, not a change to any page.
 *
 * Dates are ISO strings, not Date objects, so every adapter returns the same
 * thing and the values survive being sent from server to browser.
 */

/** One person on the attendee list, loaded from the CSV. */
export type Attendee = {
  id: string;
  /** The "no" column from the CSV. Kept for the registration desk's list. */
  no: number | null;
  staffNo: string;
  name: string;
  title: string;
  department: string;
  remark: string;
  /** Work email, lower case, or "". Used to match a scanned business card. */
  email: string;
  /**
   * The secret printed in this person's QR code on the front of their name
   * tag. Never shown on screen and never logged.
   */
  checkInToken: string;
  /** Secretariat are excluded from the lucky draw by default. */
  isSecretariat: boolean;
  createdAt: string;
  updatedAt: string;
};

/** What the CSV import hands over, before ids and tokens are assigned. */
export type AttendeeImportRow = {
  no: number | null;
  staffNo: string;
  name: string;
  title: string;
  department: string;
  remark: string;
  /** Left as it is when the list has no email for this person. */
  email?: string;
  isSecretariat?: boolean;
};

export type AttendeeImportResult = {
  created: number;
  updated: number;
  unchanged: number;
  /** Rows the importer refused, with the reason, so the file can be fixed. */
  skipped: { row: number; reason: string }[];
};

export type CheckInMethod = 'qr' | 'manual' | 'admin';

/** A day level check in. Per session check in is out of scope for this event. */
export type CheckIn = {
  id: string;
  attendeeId: string;
  /** Matches a day id in config/event.json. */
  dayId: string;
  at: string;
  method: CheckInMethod;
  /**
   * Which desk or operator recorded it, as a short label like "desk-1".
   * A label, never a person's name, so logs hold no personal data.
   */
  byOperator: string;
};

export type CheckInWithAttendee = CheckIn & { attendee: Attendee };

export type HeadcountByDepartment = {
  department: string;
  expected: number;
  arrived: number;
};

export type Headcount = {
  dayId: string;
  expected: number;
  arrived: number;
  byDepartment: HeadcountByDepartment[];
};

/** How a feedback form handles names. Set per form by an admin. */
export type AnonymityMode = 'anonymous' | 'named' | 'optional';

export type FeedbackKind = 'session' | 'event';

export type FeedbackEntry = {
  id: string;
  /** A session id for session feedback, or "event-final" for the whole event. */
  formId: string;
  kind: FeedbackKind;
  /** 1 to 5. Null when a form has no star question. */
  rating: number | null;
  /** The free text answers, keyed by question id. */
  answers: Record<string, string>;
  /** Null when the form is anonymous or the person chose not to be named. */
  attendeeId: string | null;
  displayName: string;
  /**
   * Random id kept in the browser's localStorage. Enforces one submission per
   * device per form. Not a person and not traceable to one.
   */
  deviceId: string;
  at: string;
};

export type FeedbackSummary = {
  formId: string;
  responses: number;
  /** Null when nobody has rated yet. */
  averageRating: number | null;
  /** How many picked 1, 2, 3, 4 and 5 stars. */
  ratingCounts: Record<1 | 2 | 3 | 4 | 5, number>;
};

/**
 * Small key and value store for things an admin flips during the event:
 * the countdown target, which feedback form is open, a form's anonymity mode.
 * Keeps those out of the config file, which is version controlled and
 * should not change mid event.
 */
export type Setting = {
  key: string;
  value: string;
  updatedAt: string;
};

/**
 * Where an uploaded spreadsheet came from: the Slido export (Module 7), or
 * one committee's Excel, as "committee:svc". Same store, no extra table.
 */
export type ImportSource = 'slido' | `committee:${string}`;

/**
 * One sheet kept from an uploaded spreadsheet, as plain text. Stored so the
 * report can include it, never interpreted beyond that.
 */
export type ImportedSheet = {
  id: string;
  source: ImportSource;
  /** What the sheet holds, for example "polls" or "questions". */
  kind: string;
  /** The sheet's name in the uploaded file. */
  name: string;
  headers: string[];
  rows: string[][];
  fileName: string;
  /** The desk label that uploaded it, never a person's name. */
  byOperator: string;
  importedAt: string;
};

/**
 * One lucky draw winner (an extra from the brief). Each press of "Draw" is
 * one draw, which can pick several winners; they share a drawId and are
 * numbered by position. Nobody can win twice, across every draw and day.
 */
export type LuckyDrawWinner = {
  id: string;
  drawId: string;
  /** 1 for the first name out of the hat in that draw. */
  position: number;
  /** What the draw was for, such as "Dinner door prize". May be empty. */
  prize: string;
  attendeeId: string;
  drawnAt: string;
  /** The desk label that pressed Draw, never a person's name. */
  byOperator: string;
};

export type LuckyDrawWinnerWithAttendee = LuckyDrawWinner & { attendee: Attendee };

export type PhotoStatus = 'pending' | 'approved' | 'rejected';

/**
 * A photo from the photo wall (an extra from the brief). The image itself is
 * fetched separately, so lists stay small.
 */
export type Photo = {
  id: string;
  /** The phone it came from. Not a person, and never shown. */
  deviceId: string;
  caption: string;
  status: PhotoStatus;
  width: number;
  height: number;
  sizeBytes: number;
  createdAt: string;
  reviewedAt: string | null;
  /** The desk label that approved or rejected it. */
  reviewedBy: string;
};

/* ------------------------------------------- backup Q&A and polls */

export type QuestionStatus = 'pending' | 'approved' | 'answered' | 'hidden';

/** A question for a session's Q&A (Module 2, the backup for Slido). */
export type Question = {
  id: string;
  sessionId: string;
  text: string;
  /** Empty when the person chose to stay anonymous. */
  name: string;
  /** The phone it came from. Not a person, and never shown. */
  deviceId: string;
  status: QuestionStatus;
  pinned: boolean;
  votes: number;
  createdAt: string;
};

export type PollKind = 'single' | 'multiple' | 'wordcloud';
export type PollStatus = 'draft' | 'open' | 'closed';

/** A poll (Module 3, the backup for Slido). */
export type Poll = {
  id: string;
  question: string;
  kind: PollKind;
  /** The choices. Empty for a word cloud. */
  options: string[];
  status: PollStatus;
  /** Whether results show on phones and the big screen. */
  revealed: boolean;
  position: number;
  createdAt: string;
};

/** One phone's answer: option numbers as text, or the word for a word cloud. */
export type PollVote = { pollId: string; deviceId: string; choices: string[]; at: string };

/* ------------------------------------------------------ the secretariat */

/** One line in the secretariat's log. Desk labels only, never a person. */
export type ActivityEntry = { id: string; operator: string; action: string; at: string };

/** When a desk was last seen, and on which page. */
export type OperatorPresence = { operator: string; page: string; lastSeenAt: string };
