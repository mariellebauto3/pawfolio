import type { IsoDateTime } from "@/types/api";
import type { ReportReason, ReportTargetType } from "@/types/report";
import type { AccountStatus, PetStatus, ReportStatus, RequestStatus, VerificationStatus } from "@/types/statuses";

// What the settings and admin account endpoints answer and take (docs/api/community-reports-and-admin.md,
// "Account Settings & Admin Account Management"). Nothing here is ever sent as a status or a role (FR27).

/** The details checked at verification, which only an admin can change (AC-03). Pets have the first four. */
export const LOCKED_FIELDS = ["name", "species", "breed", "approximate_age_months", "full_name", "birthdate", "city", "province"] as const;
export type LockedField = (typeof LOCKED_FIELDS)[number];

export const CHANGE_REQUEST_STATUSES = ["pending", "approved", "denied"] as const;
export type ChangeRequestStatus = (typeof CHANGE_REQUEST_STATUSES)[number];

/** The owner's own request to change a locked detail, as their Settings lists it. */
export type ChangeRequest = {
  id: number;
  field: LockedField;
  /** As it would be written: a species value, an age in months, a date as YYYY-MM-DD, or the words. */
  new_value: string;
  reason: string;
  status: ChangeRequestStatus;
  /** Whether a supporting document came with it. The file itself is for admins (SEC-PRIV-01). */
  has_document: boolean;
  reviewed_at: IsoDateTime | null;
  created_at: IsoDateTime;
};

export const NOTIFICATION_PREFERENCES = ["requests_and_invites", "meet_and_greets", "post_activity", "announcements"] as const;
export type NotificationPreference = (typeof NOTIFICATION_PREFERENCES)[number];
export type NotificationPreferences = Record<NotificationPreference, boolean>;

/** The contact details an owner edits in Settings: a pet's caretaker, or a human's own. Private (SEC-PRIV-02). */
export type ContactDetails = {
  caretaker_name?: string;
  caretaker_contact_number?: string;
  contact_number?: string;
  street_address?: string;
};

/** `GET /settings` (AC-01, AC-02). Which details there are follows `account.role`. */
export type Settings = {
  account: { id: number; role: "pet" | "human"; status: AccountStatus; email: string; display_name: string };
  /** The locked details the role has, each as the API holds it, read as text. */
  locked_details: Partial<Record<LockedField, string>>;
  contact_details: ContactDetails;
  notification_preferences: NotificationPreferences;
  /** Newest first. */
  change_requests: ChangeRequest[];
};

/** `POST /settings/change-requests` (AC-03). */
export type ChangeRequestInput = {
  field: LockedField;
  new_value: string;
  reason: string;
  document?: File | null;
};

/** `POST /settings/password` (AC-04). */
export type PasswordInput = {
  current_password: string;
  password: string;
  password_confirmation: string;
};

/** `POST /settings/deactivate` (AC-05). */
export type DeactivationInput = {
  password: string;
  reason: string | null;
};

// ---- Admin (AC-06…AC-10)

export type AccountPet = { id: number; name: string; city: string | null; status: PetStatus | null; photo_url: string | null };
export type AccountHome = { id: number; full_name: string; city: string | null; profile_photo_url: string | null; is_furparent: boolean };

/** One account in the admin's list (AC-06), and the head of its page (AC-07). Only pets and humans: never an admin. */
export type AccountSummary = {
  id: number;
  role: "pet" | "human";
  status: AccountStatus;
  email: string;
  display_name: string;
  avatar_url: string | null;
  /** The pet's or the Home Profile's id, for the link to the public profile. */
  profile_id: number | null;
  pet: AccountPet | null;
  home_profile: AccountHome | null;
  /** Who answers for a pet account. */
  caretaker_name: string | null;
  /** An adopted pet's Furparent, for the Alumni tab. */
  adoption: { id: number; furparent_name: string | null; adopted_at: IsoDateTime | null } | null;
  created_at: IsoDateTime;
};

export const ACCOUNT_ACTIONS = ["suspend", "reactivate", "deactivate"] as const;
export type AccountActionKind = (typeof ACCOUNT_ACTIONS)[number];

/** A suspension, a reactivation or a deactivation, with its reason (FR34). */
export type AccountActionRecord = {
  id: number;
  action: AccountActionKind;
  reason: string | null;
  performed_by: string | null;
  /** The owner closed their own account. */
  by_owner: boolean;
  created_at: IsoDateTime;
};

export type AccountVerification = {
  status: VerificationStatus;
  submitted_at: IsoDateTime | null;
  reviewed_at: IsoDateTime | null;
  reviewed_by: string | null;
  /** What was submitted, by kind. The files are on the verification review page. */
  documents: { id: number; type: string }[];
};

export type AccountRequest = { id: number; pet_name: string | null; home_name: string | null; status: RequestStatus; created_at: IsoDateTime };

export type AccountReports = {
  total: number;
  open: number;
  latest: { id: number; target_type: ReportTargetType; reason: ReportReason; status: ReportStatus; created_at: IsoDateTime }[];
};

/** A change request as an admin reviews it: what the account says now beside what is asked for. */
export type AdminChangeRequest = ChangeRequest & {
  current_value: string | null;
  reviewed_by: string | null;
};

export type ActivityEntry = {
  id: number;
  type: string;
  action: string;
  before_value: string | null;
  after_value: string | null;
  reason: string | null;
  created_at: IsoDateTime;
};

/** `GET /admin/accounts/{id}` (AC-07). */
export type AccountDetail = AccountSummary & {
  /** Newest first. */
  account_actions: AccountActionRecord[];
  verification: AccountVerification | null;
  /** The latest ten, newest first. */
  requests: AccountRequest[];
  reports_against: AccountReports;
  detail_change_requests: AdminChangeRequest[];
  recent_activity: ActivityEntry[];
};

/** `POST /admin/change-requests/{id}/review`. A denial needs its reason. */
export type ChangeReviewInput = { decision: "approved"; reason?: string } | { decision: "denied"; reason: string };
