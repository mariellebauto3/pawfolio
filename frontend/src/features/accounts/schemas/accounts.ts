import { SPECIES_LABELS } from "@/constants/pets";
import { PROVINCES } from "@/constants/provinces";
import type { StatusName } from "@/constants/status-badges";
import { ACCOUNT_STATUS_LABELS } from "@/constants/statuses";
import type { FieldErrors } from "@/lib/api/errors";
import { firstPasswordProblem } from "@/lib/auth/password-rules";
import { SIGN_UP_TEXT_LIMITS, approximateAgeProblem, birthdateProblem, contactNumberProblem } from "@/lib/auth/sign-up-rules";
import { formatAgeMonths } from "@/lib/utils/format-age";
import { formatDate } from "@/lib/utils/format-date";
import { ACCOUNT_STATUSES, type AccountStatus } from "@/types/statuses";
import type {
  AccountActionKind,
  AccountDetail,
  ActivityEntry,
  ChangeRequestStatus,
  ContactDetails,
  LockedField,
  NotificationPreference,
  PasswordInput,
} from "../types/accounts";

// The words and rules of Settings and Account Administration (AC-01…AC-10). The limits mirror the API's own
// (`SettingsController`, `AdminAccountController`, and the sign-up rules a locked detail was first held to), which
// checks everything again (SEC-INPUT-01, SEC-INPUT-05).

export const CHANGE_REASON_MAX = 1000;
export const DEACTIVATION_REASON_MAX = 500;
export const ADMIN_REASON_MAX = 1000;
export const ACCOUNT_SEARCH_MAX = 100;

// ---- Verified details (AC-01, AC-02, AC-03)

const PET_LOCKED: LockedField[] = ["name", "species", "breed", "approximate_age_months"];
const HUMAN_LOCKED: LockedField[] = ["full_name", "birthdate", "city", "province"];

/** The locked details a role has, in the order the screen lists them. */
export const lockedFieldsFor = (role: "pet" | "human"): LockedField[] => (role === "pet" ? PET_LOCKED : HUMAN_LOCKED);

export const LOCKED_FIELD_LABELS: Record<LockedField, string> = {
  name: "Name",
  species: "Species",
  breed: "Breed",
  approximate_age_months: "Approximate age",
  full_name: "Full name",
  birthdate: "Birthdate",
  city: "City",
  province: "Province",
};

/** A locked detail as people read it: "Dog", "2 years", "Mar 4, 1990". Anything unexpected is shown as it is. */
export function formatLockedValue(field: LockedField, value: string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "Not set";
  if (field === "species") return (SPECIES_LABELS as Record<string, string>)[value] ?? value;
  if (field === "approximate_age_months") return /^\d+$/.test(value) ? formatAgeMonths(Number(value)) : value;
  if (field === "birthdate") return formatDate(value) || value;
  return value;
}

export const CHANGE_STATUS_LABELS: Record<ChangeRequestStatus, string> = { pending: "Waiting for an admin", approved: "Approved", denied: "Denied" };

/**
 * What stands in the way of asking for a change, by field. The new value is held to the rule of the sign-up field
 * it would replace, and must differ from what the account says today.
 */
export function changeRequestProblems(input: { field: LockedField | null; new_value: string; reason: string }, current: string | undefined, today: Date): FieldErrors {
  const problems: FieldErrors = {};
  const value = input.new_value.trim();
  const reason = input.reason.trim();

  if (input.field === null) problems.field = "Choose the detail to change.";
  else if (!value) problems.new_value = "Enter the new value.";
  else {
    const problem = newValueProblem(input.field, value, today);
    if (problem) problems.new_value = problem;
    else if (value === (current ?? "").trim()) problems.new_value = "That is already what your account says.";
  }

  if (!reason) problems.reason = "Say why it should change, so an admin can check it.";
  else if (reason.length > CHANGE_REASON_MAX) problems.reason = `Keep the reason to ${CHANGE_REASON_MAX} characters or fewer.`;
  return problems;
}

function newValueProblem(field: LockedField, value: string, today: Date): string | null {
  const tooLong = (max: number) => (value.length > max ? `Use ${max} characters or fewer.` : null);
  switch (field) {
    case "name":
      return tooLong(SIGN_UP_TEXT_LIMITS.name);
    case "breed":
      return tooLong(SIGN_UP_TEXT_LIMITS.breed);
    case "full_name":
      return tooLong(SIGN_UP_TEXT_LIMITS.full_name);
    case "city":
      return tooLong(SIGN_UP_TEXT_LIMITS.city);
    case "species":
      return Object.hasOwn(SPECIES_LABELS, value) ? null : "Choose one of the listed values.";
    case "province":
      return (PROVINCES as readonly string[]).includes(value) ? null : "Choose one of the listed values.";
    case "approximate_age_months":
      return approximateAgeProblem(/^\d+$/.test(value) ? Number(value) : null);
    case "birthdate":
      return birthdateProblem(value, today);
  }
}

/** A pet's age as the API holds it, from the number and unit the form asks for. Null when it isn't a whole number. */
export function ageInMonths(amount: string, unit: "months" | "years"): number | null {
  if (!/^\d{1,3}$/.test(amount.trim())) return null;
  return Number(amount.trim()) * (unit === "years" ? 12 : 1);
}

// ---- Contact details (AC-01, AC-02)

/** The two contact fields a role edits, in the order the form shows them. */
export const contactFieldsFor = (role: "pet" | "human"): (keyof ContactDetails)[] => (role === "pet" ? ["caretaker_name", "caretaker_contact_number"] : ["contact_number", "street_address"]);

export const CONTACT_LABELS: Record<keyof ContactDetails, string> = {
  caretaker_name: "Caretaker name",
  caretaker_contact_number: "Caretaker contact number",
  contact_number: "Contact number",
  street_address: "Street address",
};

export const CONTACT_LIMITS: Record<keyof ContactDetails, number> = {
  caretaker_name: SIGN_UP_TEXT_LIMITS.caretaker_name,
  caretaker_contact_number: 32,
  contact_number: 32,
  street_address: SIGN_UP_TEXT_LIMITS.street_address,
};

const CONTACT_REQUIRED: Record<keyof ContactDetails, string> = {
  caretaker_name: "Enter the caretaker's full name.",
  caretaker_contact_number: "Enter a mobile number.",
  contact_number: "Enter a mobile number.",
  street_address: "Enter your street address.",
};

/** What stands in the way of saving the contact details, by field. */
export function contactProblems(role: "pet" | "human", values: ContactDetails): FieldErrors {
  const problems: FieldErrors = {};
  for (const field of contactFieldsFor(role)) {
    const value = (values[field] ?? "").trim();
    const isNumber = field === "caretaker_contact_number" || field === "contact_number";
    const problem = !value ? CONTACT_REQUIRED[field] : isNumber ? contactNumberProblem(value) : value.length > CONTACT_LIMITS[field] ? `Use ${CONTACT_LIMITS[field]} characters or fewer.` : null;
    if (problem) problems[field] = problem;
  }
  return problems;
}

// ---- Notifications (AC-01, AC-02)

export const NOTIFICATION_LABELS: Record<NotificationPreference, string> = {
  requests_and_invites: "Adoption requests and invites",
  meet_and_greets: "Meet & Greet bookings and reminders",
  post_activity: "Likes and comments on my posts",
  announcements: "Announcements from Pawfolio",
};

// ---- Password (AC-04)

/** What stands in the way of changing the password, by field, in the API's own words. */
export function passwordProblems(input: PasswordInput): FieldErrors {
  const problems: FieldErrors = {};
  if (!input.current_password) problems.current_password = "Enter your current password.";
  const weak = input.password ? firstPasswordProblem(input.password) : "Enter a new password.";
  if (weak) problems.password = weak;
  else if (input.password === input.current_password) problems.password = "Choose a password that is different from your current one.";
  if (!problems.password && input.password !== input.password_confirmation) problems.password_confirmation = "The passwords don't match.";
  return problems;
}

// ---- Deactivate (AC-05)

/** Why someone leaves, as the LoFi's list offers. Optional; "Other" asks for a few words. */
export const LEAVING_REASONS = ["Pet was adopted outside Pawfolio", "No longer adopting", "Privacy concerns", "Other"] as const;

/** The reason as it is stored: the choice, or the owner's own words for "Other". Null when nothing was said. */
export function leavingReason(choice: string, other: string): string | null {
  if (choice === "Other") return other.trim() || "Other";
  return choice || null;
}

// ---- Admin: the list (AC-06)

export const ACCOUNT_TAB_PARAM = "tab";
export const ACCOUNT_STATUS_PARAM = "status";
export const ACCOUNT_SEARCH_PARAM = "q";
export const ACCOUNT_PAGE_PARAM = "page";

export const ACCOUNT_TABS = [
  { id: "all", label: "All" },
  { id: "pet", label: "Pet" },
  { id: "human", label: "Human" },
  { id: "alumni", label: "Alumni" },
] as const;
export type AccountTab = (typeof ACCOUNT_TABS)[number]["id"];

export const ACCOUNT_STATUS_OPTIONS = ACCOUNT_STATUSES.map((status) => ({ value: status, label: ACCOUNT_STATUS_LABELS[status] }));

export type AccountFilters = { tab: AccountTab; status: AccountStatus | undefined; search: string | undefined };

type UrlParams = Record<string, string | string[] | undefined>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** The list's filters from the page's URL. Anything the API doesn't know is dropped, so it is never sent as typed. */
export function accountFiltersFromUrl(params: UrlParams): AccountFilters {
  const tab = first(params[ACCOUNT_TAB_PARAM]);
  const status = first(params[ACCOUNT_STATUS_PARAM]);
  const search = first(params[ACCOUNT_SEARCH_PARAM])?.trim().slice(0, ACCOUNT_SEARCH_MAX);
  return {
    tab: ACCOUNT_TABS.find((candidate) => candidate.id === tab)?.id ?? "all",
    status: (ACCOUNT_STATUSES as readonly string[]).includes(status ?? "") ? (status as AccountStatus) : undefined,
    search: search || undefined,
  };
}

/** An account's id from its page's address, or null when it isn't a plain id (SEC-FE-08). */
export function accountIdFromUrl(value: string): number | null {
  return /^[1-9]\d{0,14}$/.test(value) ? Number(value) : null;
}

// ---- Admin: one account (AC-07…AC-10)

/** Which of the three actions an account's status offers (LoFi AC-07): the API refuses the others (SEC-FE-05). */
export function accountActionsFor(status: AccountStatus): AccountActionKind[] {
  if (status === "active") return ["suspend", "deactivate"];
  if (status === "suspended") return ["reactivate", "deactivate"];
  return status === "deactivated" ? [] : ["deactivate"];
}

export type HistoryEvent = { id: string; title: string; when: string; status: StatusName; description?: string };

const ACTION_STATUS: Record<AccountActionKind, StatusName> = { suspend: "Suspended", reactivate: "Active", deactivate: "Deactivated" };

/**
 * The account's status history, oldest first (AC-07): signing up, the verification decision, then every suspension,
 * reactivation and deactivation with who did it and why.
 */
export function statusHistory(account: Pick<AccountDetail, "created_at" | "verification" | "account_actions">): HistoryEvent[] {
  const events: HistoryEvent[] = [{ id: "signed-up", title: "Signed up", when: account.created_at, status: "Pending Verification" }];
  const { verification } = account;

  if (verification?.reviewed_at && verification.status !== "pending") {
    const by = verification.reviewed_by ? ` by ${verification.reviewed_by}` : "";
    events.push(
      verification.status === "approved"
        ? { id: "verified", title: `Verification approved${by}`, when: verification.reviewed_at, status: "Active" }
        : { id: "verified", title: `Verification denied${by}`, when: verification.reviewed_at, status: "Denied" },
    );
  }

  for (const action of [...account.account_actions].reverse()) {
    const who = action.by_owner ? "the owner" : (action.performed_by ?? "an admin");
    const verb = action.action === "suspend" ? "Suspended" : action.action === "reactivate" ? "Reactivated" : action.by_owner ? "Closed" : "Deactivated";
    events.push({ id: `action-${action.id}`, title: `${verb} by ${who}`, when: action.created_at, status: ACTION_STATUS[action.action], description: action.reason ?? undefined });
  }

  return events.sort((a, b) => Date.parse(a.when) - Date.parse(b.when));
}

const ACTIVITY_LABELS: Record<string, string> = {
  signed_in: "Signed in",
  signed_out: "Signed out",
  sign_in_failed: "Failed sign-in",
  password_changed: "Changed the password",
  account_settings_updated: "Updated settings",
  detail_change_requested: "Asked to change a verified detail",
  account_suspended: "Suspended",
  account_suspended_from_report: "Suspended after a report",
  account_reactivated: "Reactivated",
  account_deactivated: "Deactivated by an admin",
  account_deactivated_by_owner: "Closed by the owner",
  report_submitted: "Filed a report",
};

/** A log entry in plain words. An action this screen doesn't know is written from its own name. */
export function activityLabel(entry: Pick<ActivityEntry, "action">): string {
  const known = ACTIVITY_LABELS[entry.action];
  if (known) return known;
  const words = entry.action.replace(/_/g, " ").trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : "Activity";
}

/** What stands in the way of an admin action that needs a reason. */
export function adminReasonProblem(reason: string, missing: string): string | null {
  const text = reason.trim();
  if (!text) return missing;
  return text.length > ADMIN_REASON_MAX ? `Keep it to ${ADMIN_REASON_MAX} characters or fewer.` : null;
}
