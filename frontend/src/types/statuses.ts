// Roles and statuses exactly as the API sends them (snake_case values of the backend enums). The lists mirror the
// enum columns in backend/database/migrations; keep them in sync. Display names live in src/constants/statuses.ts.
// Statuses are system-set only (FR27): the frontend reads them, never sends them.

export const ROLES = ["pet", "human", "admin"] as const;
export type Role = (typeof ROLES)[number];

/** Proposal §5.1. Only `active` accounts can use member features. */
export const ACCOUNT_STATUSES = ["pending_verification", "active", "denied", "suspended", "deactivated"] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

/** Proposal §5.2. `adopted_hired` is permanent. */
export const PET_STATUSES = ["draft", "looking_for_a_home", "in_process", "adopted_hired"] as const;
export type PetStatus = (typeof PET_STATUSES)[number];

/** Proposal §5.3. */
export const REQUEST_STATUSES = [
  "sent",
  "on_hold",
  "approved",
  "meet_scheduled",
  "awaiting_decision",
  "adopted",
  "declined",
  "not_adopted",
  "withdrawn",
  "closed",
  "expired",
] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

/** Proposal §5.4: one booking of a slot for a request. */
export const MEET_STATUSES = ["booked", "confirmed", "ended"] as const;
export type MeetStatus = (typeof MEET_STATUSES)[number];

/** A verification submission, reviewed by an admin (FR33). */
export const VERIFICATION_STATUSES = ["pending", "approved", "denied"] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const REPORT_STATUSES = ["open", "resolved"] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];
