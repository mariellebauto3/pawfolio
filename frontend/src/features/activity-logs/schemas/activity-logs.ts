import { STATUS_TONES, type StatusName } from "@/constants/status-badges";
import { ACCOUNT_STATUS_LABELS, PET_STATUS_LABELS, REQUEST_STATUS_LABELS } from "@/constants/statuses";
import { ACTIVITY_TYPES, ACTOR_ROLES, type ActivityEntry, type ActivityType, type ActorRole } from "../types/activity-logs";

// How the activity log is addressed and put into words (LG-01…LG-04). The API names an action
// (`adoption_request_approved`) and a value (`in_process`); people read "Adoption request approved" and
// "In Process". Everything here is a pure function of what the API answered.

export const ACTIVITY_TAB_PARAM = "tab";
export const ACTIVITY_PAGE_PARAM = "page";
export const LOG_ACTOR_PARAM = "actor";
export const LOG_TYPE_PARAM = "type";
export const LOG_PAGE_PARAM = "page";

export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  verification: "Verification",
  account: "Account",
  status_change: "Status change",
  request: "Request",
  meet_and_greet: "Meet & Greet",
  adoption: "Adoption",
  feed: "Feed",
  profile: "Profile",
  moderation: "Moderation",
  announcement: "Announcement",
  security: "Security",
  system: "System",
};

/**
 * The tabs of My activity (LG-01, LG-02), with the types each lists. Twelve types would not fit a phone, so the
 * ones a member reads together share a tab; the Type column still names each entry's own.
 */
export const ACTIVITY_TABS = [
  { id: "all", label: "All", types: [] },
  { id: "requests", label: "Requests", types: ["request", "adoption"] },
  { id: "meet-and-greets", label: "Meet & Greet", types: ["meet_and_greet"] },
  { id: "status", label: "Status", types: ["status_change", "system"] },
  { id: "profile", label: "Profile", types: ["profile"] },
  { id: "feed", label: "Feed", types: ["feed"] },
  { id: "account", label: "Account", types: ["account", "verification", "moderation"] },
  { id: "security", label: "Security", types: ["security"] },
] as const satisfies readonly { id: string; label: string; types: readonly ActivityType[] }[];
export type ActivityTab = (typeof ACTIVITY_TABS)[number]["id"];

type UrlValue = string | string[] | undefined;
const first = (value: UrlValue) => (Array.isArray(value) ? value[0] : value);

/** The tab from the page's URL; anything unknown is "All", so it never reaches the API as typed. */
export function activityTabFromUrl(value: UrlValue): ActivityTab {
  return ACTIVITY_TABS.find((tab) => tab.id === first(value))?.id ?? "all";
}

export const typesForTab = (tab: ActivityTab): readonly ActivityType[] => ACTIVITY_TABS.find((candidate) => candidate.id === tab)?.types ?? [];

/** Who acted, as the admin's filter names them. */
export const ACTOR_ROLE_LABELS: Record<ActorRole, string> = { admin: "Admins", pet: "Pets", human: "Humans", system: "System" };

export type LogFilters = { actor: ActorRole | undefined; type: ActivityType | undefined };

/** The admin log's filters from the page's URL. Anything the API doesn't know is dropped. */
export function logFiltersFromUrl(params: Record<string, UrlValue>): LogFilters {
  const actor = first(params[LOG_ACTOR_PARAM]);
  const type = first(params[LOG_TYPE_PARAM]);
  return {
    actor: (ACTOR_ROLES as readonly string[]).includes(actor ?? "") ? (actor as ActorRole) : undefined,
    type: (ACTIVITY_TYPES as readonly string[]).includes(type ?? "") ? (type as ActivityType) : undefined,
  };
}

/** The filters as a query, for links that keep them (a page past the end, "Clear filters" leaves them out). */
export function logQueryFor(filters: LogFilters, page?: number): Record<string, string> {
  return { ...(filters.actor && { [LOG_ACTOR_PARAM]: filters.actor }), ...(filters.type && { [LOG_TYPE_PARAM]: filters.type }), ...(page && page > 1 && { [LOG_PAGE_PARAM]: String(page) }) };
}

// Every action the API writes to the log (backend: ActivityLogger::log calls), in the words of the screens.
const ACTION_LABELS: Record<string, string> = {
  // Accounts and verification
  signed_up: "Signed up",
  verification_resubmitted: "Details sent in again for verification",
  account_approved: "Account approved",
  account_denied: "Account denied",
  admin_account_created: "Admin account created",
  account_suspended: "Account suspended",
  account_suspended_from_report: "Account suspended after a report",
  account_reactivated: "Account reactivated",
  account_deactivated: "Account deactivated by an admin",
  account_deactivated_by_owner: "Account deactivated by its owner",
  account_settings_updated: "Settings updated",
  detail_change_requested: "Change to a verified detail requested",
  detail_change_approved: "Change to a verified detail approved",
  detail_change_denied: "Change to a verified detail denied",
  // Security
  signed_in: "Signed in",
  sign_in_failed: "Sign-in failed",
  sign_in_refused_deactivated: "Sign-in refused for a deactivated account",
  password_changed: "Password changed",
  password_reset: "Password reset",
  admin_access_denied: "Admin page refused",
  // Profiles
  pet_resume_updated: "Resume updated",
  pet_photo_added: "Photo added to the resume",
  pet_resume_published: "Resume published",
  home_profile_updated: "Home Profile updated",
  home_intro_updated: "Home Profile introduction updated",
  open_to_adopt_enabled: "Open to Adopt turned on",
  open_to_adopt_disabled: "Open to Adopt turned off",
  // Requests
  invite_to_apply_sent: "Invite to Apply sent",
  adoption_request_sent: "Adoption request sent",
  adoption_request_approved: "Adoption request approved",
  adoption_request_declined: "Adoption request declined",
  adoption_request_withdrawn: "Adoption request withdrawn",
  adoption_request_not_adopted: "Declined after the Meet & Greet",
  adoption_request_closed: "Adoption request closed",
  adoption_request_expired: "Adoption request expired",
  approved_request_expired_no_booking: "Approved request expired with no Meet & Greet booked",
  adoption_request_meet_scheduled: "Request moved to Meet Scheduled",
  adoption_request_awaiting_decision: "Request moved to Awaiting Decision",
  adoption_request_booking_reopened: "Request moved back to Approved",
  adoption_request_flagged_overdue: "Decision flagged overdue",
  admin_request_reminder_sent: "Reminder sent by an admin",
  admin_request_status_changed: "Request status changed by an admin",
  // Meet & Greet
  meet_greet_slots_added: "Meet & Greet times added",
  meet_and_greet_booked: "Meet & Greet booked",
  meet_and_greet_confirmed: "Meet & Greet confirmed",
  meet_and_greet_time_proposed: "Another Meet & Greet time proposed",
  meet_and_greet_rescheduled: "Meet & Greet rescheduled",
  meet_and_greet_cancelled: "Meet & Greet cancelled",
  meet_and_greet_didnt_happen: "Meet & Greet reported as not held",
  // Adoption and pet status
  adoption_confirmed: "Adoption confirmed",
  pet_adopted_hired: "Pet status changed to Hired",
  pet_status_in_process: "Pet status changed to In Process",
  pet_status_looking_for_home: "Pet status changed to Looking for a Home",
  admin_adoption_resolved: "Adoption issue resolved by an admin",
  adoption_link_removed: "Adoption link removed",
  // Feed and moderation
  post_created: "Post published",
  adoption_story_created: "Adoption story published",
  post_deleted: "Post deleted",
  report_submitted: "Report filed",
  report_resolved_remove_content: "Report resolved: content removed",
  report_resolved_suspend_account: "Report resolved: account suspended",
  report_resolved_remove_content_and_suspend: "Report resolved: content removed and account suspended",
  report_resolved_dismiss: "Report dismissed",
  reported_content_restored: "Reported content restored",
  // Announcements
  announcement_published: "Announcement published",
  announcement_scheduled: "Announcement scheduled",
};

/** `in_process` as "In process": a name this screen has no words for is still readable. */
function fromName(name: string): string {
  const words = name.replace(/_/g, " ").trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : "";
}

/** What happened, in plain words. An action this screen doesn't know is written from its own name. */
export function actionLabel(entry: Pick<ActivityEntry, "action">): string {
  return ACTION_LABELS[entry.action] ?? (fromName(entry.action) || "Activity");
}

// Values the log keeps before and after a change. Statuses use the proposal's exact names.
const VALUE_LABELS: Record<string, string> = {
  ...ACCOUNT_STATUS_LABELS,
  ...PET_STATUS_LABELS,
  ...REQUEST_STATUS_LABELS,
  booked: "Booked",
  confirmed: "Confirmed",
  ended: "Ended",
  open: "Open",
  resolved: "Resolved",
  pending: "Pending",
  removed: "Removed",
  visible: "Visible",
  everyone: "Everyone",
  pets: "Pets",
  humans: "Humans",
  pet: "Pet",
  human: "Human",
};

/** A before or after value in the screens' words; anything else (a name, "24", "3 slot(s)") is shown as it is. */
export const valueLabel = (value: string): string => VALUE_LABELS[value] ?? value;

/** The status badge a value has, when it is a status the badges know. */
export function valueStatus(value: string): StatusName | null {
  const label = valueLabel(value);
  return label in STATUS_TONES ? (label as StatusName) : null;
}

/**
 * A reason as an admin reads it. Some are a person's own words; some are a name the system keeps
 * (`fake_profile`), alone or before the words (`unreadable_id: The photo is too dark`). The name is put into words;
 * what a person typed is left exactly as typed.
 */
export function reasonText(reason: string): string {
  const named = /^([a-z][a-z0-9]*(?:_[a-z0-9]+)+|[a-z]{3,})(?:: ([\s\S]+))?$/.exec(reason);
  if (!named) return reason;
  const [, name, words] = named;
  // One lower-case word with nothing after it is as likely someone's own word: leave it.
  if (!name.includes("_") && words === undefined) return reason;
  return words === undefined ? fromName(name) : `${fromName(name)}: ${words}`;
}

/** "By Ana Santos", for an entry the reader didn't make themselves. Null for their own. */
export function byLine(actor: ActivityEntry["actor"]): string | null {
  if (actor.is_you) return null;
  if (actor.role === "system") return "By the system";
  if (actor.role === "admin" && actor.id === null) return "By an admin";
  return `By ${actor.display_name}`;
}

/** The role under a name in the Who column. */
export const ACTOR_ROLE_NAMES: Record<ActorRole, string> = { admin: "Admin", pet: "Pet", human: "Human", system: "Scheduled or automatic" };

// Records that are between two sides, whose label ("Mochi to Ana Santos") says something the reader's own name
// doesn't.
const BETWEEN_TWO = new Set(["AdoptionRequest", "MeetAndGreet", "Adoption", "Invite"]);

/**
 * What an entry was about, for a member's own activity: named only when it is between two sides. "Mochi" under
 * every line of Mochi's own activity would say nothing.
 */
export function memberAboutLine(entry: Pick<ActivityEntry, "subject_type" | "subject_label">): string | null {
  return entry.subject_type !== null && BETWEEN_TWO.has(entry.subject_type) ? entry.subject_label : null;
}

/** "12 entries by Admins of type Security", above the admin's table. */
export function logSummary(total: number, filters: LogFilters): string {
  const what = total === 1 ? "entry" : "entries";
  const by = filters.actor ? ` by ${filters.actor === "system" ? "the system" : ACTOR_ROLE_LABELS[filters.actor].toLowerCase()}` : "";
  const type = filters.type ? `, type ${ACTIVITY_TYPE_LABELS[filters.type]}` : "";
  return `${total} ${what}${by}${type}`;
}

/** The newest entries an admin's export holds; the API stops there. */
export const ADMIN_EXPORT_LIMIT = 2000;

/** "pawfolio-my-activity-2026-10-10.csv": the day in the Philippines the file was made. */
export function exportFileName(scope: "mine" | "all", now: Date = new Date()): string {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  return `pawfolio-${scope === "mine" ? "my-activity" : "activity-logs"}-${day}.csv`;
}
