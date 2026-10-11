import type { FieldErrors } from "@/lib/api/errors";
import { formatDateTime, formatMeetingTime, philippineTimeToIso } from "@/lib/utils/format-date";
import type { AdminAnnouncement, AnnouncementAudience, AudienceCounts, NewAnnouncement, StoredAnnouncement } from "../types/announcements";

// The admin's announcement form (NT-04, NT-05): its limits and its rules, mirroring the API's
// StoreAnnouncementRequest, and how an audience, a time and a result are put into words. The API has the last word
// on every rule (SEC-INPUT-05).

export const ANNOUNCEMENT_TITLE_MAX = 160;
export const ANNOUNCEMENT_MESSAGE_MAX = 2000;

/** How far ahead the API lets an announcement be scheduled. */
const SCHEDULE_AHEAD_MS = 365 * 24 * 60 * 60 * 1000;

export const ANNOUNCEMENTS_PAGE_PARAM = "page";
/** A page of the list beside the form: short enough to sit next to it. */
export const ANNOUNCEMENTS_PAGE_SIZE = 10;

export const AUDIENCE_LABELS = {
  everyone: "Everyone",
  pets: "Pets only",
  humans: "Humans only",
} as const satisfies Record<AnnouncementAudience, string>;

export const AUDIENCE_OPTIONS = (Object.keys(AUDIENCE_LABELS) as AnnouncementAudience[]).map((value) => ({ value, label: AUDIENCE_LABELS[value] }));

/** Publish now, or pick a day and a time. */
export type PublishWhen = "now" | "later";

/** What the admin has typed so far. The day and the time are Philippine time, as the screens show every time. */
export type AnnouncementDraft = {
  title: string;
  message: string;
  audience: AnnouncementAudience;
  when: PublishWhen;
  date: string;
  time: string;
};

export const EMPTY_DRAFT: AnnouncementDraft = { title: "", message: "", audience: "everyone", when: "now", date: "", time: "" };

export type AnnouncementErrors = Partial<Record<"title" | "message" | "audience" | "date" | "time", string>>;

/**
 * The announcement the form would send, or what is wrong with it, in the words under each field. The same messages
 * as the API's, so a rule reads the same whichever side catches it.
 */
export function readAnnouncementDraft(draft: AnnouncementDraft, now: Date = new Date()): { announcement: NewAnnouncement } | { errors: AnnouncementErrors } {
  const errors: AnnouncementErrors = {};
  const title = draft.title.trim();
  const message = draft.message.trim();

  if (title === "") errors.title = "Enter a title.";
  else if (title.length > ANNOUNCEMENT_TITLE_MAX) errors.title = `Keep the title to ${ANNOUNCEMENT_TITLE_MAX} characters or fewer.`;
  if (message === "") errors.message = "Enter a message.";
  else if (message.length > ANNOUNCEMENT_MESSAGE_MAX) errors.message = `Keep the message to ${ANNOUNCEMENT_MESSAGE_MAX} characters or fewer.`;
  if (!(draft.audience in AUDIENCE_LABELS)) errors.audience = "Choose who the announcement is for.";

  let publishAt: string | null = null;
  if (draft.when === "later") {
    if (!draft.date) errors.date = "Choose a date.";
    if (!draft.time) errors.time = "Choose a time.";
    if (draft.date && draft.time) {
      publishAt = philippineTimeToIso(draft.date, draft.time);
      const at = publishAt ? new Date(publishAt).getTime() : Number.NaN;
      if (Number.isNaN(at)) errors.date = "Enter a valid date and time.";
      else if (at <= now.getTime()) errors.time = "Choose a time that is still ahead, or publish now.";
      else if (at >= now.getTime() + SCHEDULE_AHEAD_MS) errors.date = "Choose a time within the next year.";
    }
  }

  if (Object.keys(errors).length > 0) return { errors };
  return { announcement: { title, message, audience: draft.audience, publish_at: publishAt } };
}

/** The API's 422 under the form's own fields: `publish_at` is one value there and two controls here. */
export function announcementErrorsFromApi(fieldErrors: FieldErrors): AnnouncementErrors {
  return { title: fieldErrors.title, message: fieldErrors.message, audience: fieldErrors.audience, time: fieldErrors.publish_at };
}

const accounts = (count: number) => `${count} Active ${count === 1 ? "account" : "accounts"}`;

/** "Everyone (42 Active accounts)", or just the audience when the API didn't say how many. */
export function audienceLine(audience: AnnouncementAudience, counts: AudienceCounts): string {
  const count = counts[audience];
  return count === undefined ? AUDIENCE_LABELS[audience] : `${AUDIENCE_LABELS[audience]} (${accounts(count)})`;
}

/** Under the audience control: who gets it. Empty when the API didn't say how many. */
export function audienceHint(audience: AnnouncementAudience, counts: AudienceCounts): string {
  const count = counts[audience];
  if (count === undefined) return "";
  if (count === 0) return "No Active account is in this audience right now.";
  return `${accounts(count)} right now. Accounts approved later read it on the feed.`;
}

/** "Sat, Oct 12, 10:00 AM" for a time someone picked; the year is on the list. */
export const scheduledFor = (iso: string) => formatMeetingTime(iso);

/** The toast after publishing or scheduling, from what the API stored. */
export function storedToast(stored: StoredAnnouncement): string {
  if (stored.status === "scheduled") {
    const at = stored.publish_at ? scheduledFor(stored.publish_at) : "";
    return at ? `Announcement scheduled for ${at}.` : "Announcement scheduled.";
  }
  const notified = stored.recipients_notified;
  if (notified === null) return "Announcement published.";
  return `Announcement published. ${notified === 1 ? "1 account was" : `${notified} accounts were`} notified.`;
}

/** "Oct 10, 2026, 3:10 PM, Everyone, by admin.jess": when it went out or goes out, to whom, and whose it is. */
export function announcementMeta(announcement: AdminAnnouncement): string {
  const at = announcement.status === "published" ? (announcement.published_at ?? announcement.created_at) : announcement.publish_at;
  return [at && formatDateTime(at), AUDIENCE_LABELS[announcement.audience], announcement.admin_name && `by ${announcement.admin_name}`].filter(Boolean).join(", ");
}
