import type { IsoDateTime } from "@/types/api";
import type { PostType } from "@/types/post";
import type { ReportAction, ReportReason, ReportTargetType } from "@/types/report";
import type { AccountStatus, ReportStatus, Role } from "@/types/statuses";

// What the reports endpoints answer and take (docs/api/community-reports-and-admin.md, "Reports & Moderation").

/** What the report dialog sends with its target (RP-01). Never a status, and never who is reporting (FR27). */
export type ReportInput = {
  reason: ReportReason;
  /** Up to 1000 characters; required with "Something else". */
  details: string | null;
};

/** `POST /reports`: the report as it was filed. */
export type FiledReport = {
  id: number;
  status: ReportStatus;
};

export type ReportParty = {
  id: number;
  display_name: string;
  role: Role;
};

/** The account behind the reported item. The review page also says when it joined and how often it was reported. */
export type ReportedAccount = ReportParty & {
  status: AccountStatus;
  /** The pet's or the Home Profile's id, for the link to the public profile. */
  profile_id: number | null;
  joined_at: IsoDateTime | null;
  /** Every report ever filed against the account, on any of its items. */
  reports_against_count: number | null;
};

/** The admin's decision that resolved a report, and every other open report on the same item (RP-05). */
export type ReportDecision = {
  id: number;
  action: ReportAction;
  /** Shown to the owner of the reported item, unless the report was dismissed. */
  reason: string;
  notify_reporters: boolean;
  /** The admin's name; null when that account is gone. */
  performed_by: string | null;
  created_at: IsoDateTime;
};

/**
 * One row of the queue (RP-03): a reported item, stood for by its latest report. `reports_count` is how many
 * reports on the item share the row's status.
 */
export type ReportSummary = {
  id: number;
  target_type: ReportTargetType;
  reason: ReportReason;
  details: string | null;
  status: ReportStatus;
  reports_count: number;
  post_id: number | null;
  comment_id: number | null;
  reporter: ReportParty | null;
  reported_user: ReportedAccount | null;
  report_action: ReportDecision | null;
  created_at: IsoDateTime;
};

export type ReportedPost = {
  id: number;
  type: PostType | null;
  title: string | null;
  body: string;
  photos: { id: number; url: string }[];
  /** An admin removed it; it can be restored. */
  is_removed: boolean;
  /** Its author deleted it; nothing brings it back. */
  is_deleted: boolean;
  created_at: IsoDateTime | null;
};

export type ReportedComment = {
  id: number;
  body: string;
  is_removed: boolean;
  created_at: IsoDateTime | null;
};

/** One member's report on the item, as the review lists them (RP-04). */
export type ItemReport = {
  id: number;
  reporter_name: string | null;
  reason: ReportReason;
  details: string | null;
  status: ReportStatus;
  created_at: IsoDateTime;
};

/** `GET /admin/reports/{id}`: the report, what it is about, and every report on the same item, newest first. */
export type ReportDetail = ReportSummary & {
  /** A report on a comment carries the post it is under as well; a profile or an account carries neither. */
  content_preview: { post: ReportedPost | null; comment: ReportedComment | null };
  sibling_reports: ItemReport[];
};

/** What an admin does from the review page: one of the stored actions, or putting removed content back. */
export type ModerationAction = ReportAction | "restore_content";

/** `POST /admin/reports/{id}/actions`. The reason is always required (SEC-AUTHZ-07). */
export type ModerationInput = {
  action: ModerationAction;
  reason: string;
  /** Tell the members who reported it that it was reviewed. Left out for a restore. */
  notify_reporters?: boolean;
};
