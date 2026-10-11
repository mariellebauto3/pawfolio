import type { FieldErrors } from "@/lib/api/errors";
import { REPORT_ACTIONS, REPORT_REASONS, type ReportAction, type ReportReason, type ReportTarget, type ReportTargetType } from "@/types/report";
import type { ReportStatus } from "@/types/statuses";
import type { ModerationAction, ReportDetail, ReportSummary } from "../types/reports";

// The words and rules of reporting and moderation (RP-01…RP-05). The limits mirror the API's own
// (`ReportController`), which checks everything again (SEC-INPUT-01, SEC-INPUT-05).

/** `details` on a report and `reason` on an action: 1000 characters. */
export const REPORT_DETAILS_MAX = 1000;
export const ACTION_REASON_MAX = 1000;

/** The reasons as the dialog lists them, in the LoFi's order (RP-01). */
export const REPORT_REASON_OPTIONS: { value: ReportReason; label: string; description: string }[] = [
  { value: "fake_or_misleading_profile", label: "Fake or misleading profile", description: "Photos or details that aren’t real" },
  { value: "selling_or_trading_animals", label: "Selling or trading animals", description: "Pawfolio is for adoption only" },
  { value: "harassment_or_hate", label: "Harassment or hate", description: "Insults, threats, or targeting someone" },
  { value: "animal_welfare_concern", label: "Animal welfare concern", description: "Signs of neglect or abuse" },
  { value: "spam_or_scam", label: "Spam or scam", description: "Ads, links, or asking for money" },
  { value: "something_else", label: "Something else", description: "Tell us in the details" },
];

export const REPORT_REASON_LABELS = Object.fromEntries(REPORT_REASON_OPTIONS.map(({ value, label }) => [value, label])) as Record<ReportReason, string>;

export const isReportReason = (value: unknown): value is ReportReason => (REPORT_REASONS as readonly unknown[]).includes(value);
export const isReportAction = (value: unknown): value is ReportAction => (REPORT_ACTIONS as readonly unknown[]).includes(value);

/** What stands in the way of sending a report, by field. Empty when it can be sent. */
export function reportProblems(input: { reason: unknown; details: string }): FieldErrors {
  const problems: FieldErrors = {};
  const details = input.details.trim();
  if (!isReportReason(input.reason)) problems.reason = "Choose a reason.";
  else if (input.reason === "something_else" && !details) problems.details = "Tell us what is wrong, so an admin knows what to look for.";
  if (details.length > REPORT_DETAILS_MAX) problems.details = `Keep the details to ${REPORT_DETAILS_MAX} characters or fewer.`;
  return problems;
}

/**
 * What the API is told a report is about. A profile is named by the pet's or the Home Profile's own id, and whose
 * the item is the API reads from the record, never from here (SEC-AUTHZ-02).
 */
export function reportTargetBody(target: ReportTarget): Record<string, string | number> {
  switch (target.kind) {
    case "post":
      return { target_type: "post", post_id: target.postId };
    case "comment":
      return { target_type: "comment", comment_id: target.commentId };
    case "pet":
      return { target_type: "profile", pet_id: target.petId };
    case "home":
      return { target_type: "profile", home_profile_id: target.homeProfileId };
    case "account":
      return { target_type: "account", reported_user_id: target.accountId };
  }
}

/** The dialog's title: what is being reported, in the reader's words. */
export function reportTitle(target: ReportTarget): string {
  switch (target.kind) {
    case "post":
      return `Report ${target.ownerName}’s post`;
    case "comment":
      return `Report ${target.ownerName}’s comment`;
    case "pet":
      return `Report ${target.ownerName}’s resume`;
    case "home":
      return `Report ${target.ownerName}’s Home Profile`;
    case "account":
      return `Report ${target.ownerName}’s account`;
  }
}

export const TARGET_TYPE_LABELS: Record<ReportTargetType, string> = { profile: "Profile", post: "Post", comment: "Comment", account: "Account" };

/** What a row of the queue is about: "Post by Mochi", "Mochi’s profile". */
export function reportedItemName(report: Pick<ReportSummary, "target_type" | "reported_user">): string {
  const name = report.reported_user?.display_name;
  switch (report.target_type) {
    case "post":
      return name ? `Post by ${name}` : "Post by an account that is gone";
    case "comment":
      return name ? `Comment by ${name}` : "Comment by an account that is gone";
    case "profile":
      return name ? `${name}’s profile` : "Profile of an account that is gone";
    case "account":
      return name ? `${name}’s account` : "An account that is gone";
  }
}

export const countReports = (count: number) => `${count} ${count === 1 ? "report" : "reports"}`;

// The queue's tabs (RP-03). The selected one lives in the URL (`?tab=resolved`); Open is the default and stays out.
export const REPORT_TAB_PARAM = "tab";
export const REPORT_PAGE_PARAM = "page";
export const REPORT_TABS: { id: ReportStatus; label: string }[] = [
  { id: "open", label: "Open" },
  { id: "resolved", label: "Resolved" },
];

/** The tab named in the page's URL. Anything else is Open, so a hand-edited address never reaches the API as typed. */
export function reportTabFromUrl(value: string | string[] | undefined): ReportStatus {
  const text = Array.isArray(value) ? value[0] : value;
  return text === "resolved" ? "resolved" : "open";
}

/** A report's id from its page's address, or null when it isn't a plain id (SEC-FE-08). */
export function reportIdFromUrl(value: string): number | null {
  return /^[1-9]\d{0,14}$/.test(value) ? Number(value) : null;
}

export const ACTION_LABELS: Record<ModerationAction, string> = {
  remove_content: "Content removed",
  suspend_account: "Account suspended",
  remove_content_and_suspend: "Content removed and account suspended",
  dismiss: "Dismissed",
  restore_content: "Content restored",
};

export type ActionOption = { value: ReportAction; label: string; description: string; confirmLabel: string; destructive: boolean };

const ACTION_OPTIONS: Record<ReportAction, Omit<ActionOption, "value">> = {
  remove_content: { label: "Remove the content", description: "Hides it for everyone. It can be restored later from Resolved.", confirmLabel: "Remove content", destructive: true },
  suspend_account: {
    label: "Suspend the account",
    description: "The owner is signed out and the profile is hidden. They see your reason. An admin can reactivate it.",
    confirmLabel: "Suspend account",
    destructive: true,
  },
  remove_content_and_suspend: { label: "Remove content and suspend", description: "Both of the above.", confirmLabel: "Remove and suspend", destructive: true },
  dismiss: { label: "Dismiss", description: "No violation found. Nothing changes for the owner, and they aren’t told.", confirmLabel: "Dismiss report", destructive: false },
};

/**
 * The actions an open report offers (RP-05). A profile or an account has nothing to remove, and only an Active
 * account can be suspended, so those are left out instead of being refused by the API after the fact.
 */
export function actionOptionsFor(report: Pick<ReportDetail, "content_preview" | "reported_user">): ActionOption[] {
  const content = report.content_preview.comment ?? report.content_preview.post;
  const removable = content !== null && !content.is_removed && !(report.content_preview.comment === null && report.content_preview.post?.is_deleted);
  const suspendable = report.reported_user?.status === "active";
  return REPORT_ACTIONS.filter((action) => {
    if (action === "dismiss") return true;
    if (action === "remove_content") return removable;
    if (action === "suspend_account") return suspendable;
    return removable && suspendable;
  }).map((value) => ({ value, ...ACTION_OPTIONS[value] }));
}

/** What stands in the way of applying an action, by field. Empty when it can be sent. */
export function actionProblems(input: { action: unknown; reason: string }): FieldErrors {
  const problems: FieldErrors = {};
  const reason = input.reason.trim();
  if (!isReportAction(input.action)) problems.action = "Choose what to do.";
  if (!reason) problems.reason = "Enter a reason for this moderation action.";
  else if (reason.length > ACTION_REASON_MAX) problems.reason = `Keep the reason to ${ACTION_REASON_MAX} characters or fewer.`;
  return problems;
}

/** The toast after an action went through (RP-05), naming what happened. */
export const ACTION_DONE: Record<ModerationAction, string> = {
  remove_content: "Content removed. The report is resolved.",
  suspend_account: "Account suspended. The report is resolved.",
  remove_content_and_suspend: "Content removed and account suspended. The report is resolved.",
  dismiss: "Report dismissed.",
  restore_content: "Content restored. It is visible again.",
};
