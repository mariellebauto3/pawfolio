// Reporting, as the API names it (backend enums `ReportReason`, `ReportTargetType`, `ReportAction`; keep in sync).
// Shared because the screens that offer Report (the feed, a resume, a Home Profile) only know what they hand over.

/** Why something is reported (RP-01). "Selling or trading animals" is always one of them (SEC-ABUSE-02). */
export const REPORT_REASONS = [
  "fake_or_misleading_profile",
  "selling_or_trading_animals",
  "harassment_or_hate",
  "animal_welfare_concern",
  "spam_or_scam",
  "something_else",
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

/** What a report is about, as it is stored (FR16, FR32). */
export const REPORT_TARGET_TYPES = ["profile", "post", "comment", "account"] as const;
export type ReportTargetType = (typeof REPORT_TARGET_TYPES)[number];

/** What an admin did with a reported item (RP-05, FR35). */
export const REPORT_ACTIONS = ["remove_content", "suspend_account", "remove_content_and_suspend", "dismiss"] as const;
export type ReportAction = (typeof REPORT_ACTIONS)[number];

/**
 * What a member reports, as the screen that offers Report knows it. `ownerName` is whose it is, for the dialog's
 * title; whose it really is, the API reads from the record (SEC-AUTHZ-02).
 */
export type ReportTarget =
  | { kind: "post"; postId: number; ownerName: string }
  | { kind: "comment"; commentId: number; ownerName: string }
  | { kind: "pet"; petId: number; ownerName: string }
  | { kind: "home"; homeProfileId: number; ownerName: string }
  | { kind: "account"; accountId: number; ownerName: string };
