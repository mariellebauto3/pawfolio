import { describe, expect, it } from "vitest";
import {
  ACTION_REASON_MAX,
  REPORT_DETAILS_MAX,
  REPORT_REASON_OPTIONS,
  actionOptionsFor,
  actionProblems,
  reportIdFromUrl,
  reportProblems,
  reportTabFromUrl,
  reportTargetBody,
  reportTitle,
  reportedItemName,
} from "@/features/reports/schemas/reports";
import type { ReportDetail, ReportedAccount } from "@/features/reports/types/reports";
import { REPORT_REASONS } from "@/types/report";

const account = (status: ReportedAccount["status"]): ReportedAccount => ({ id: 7, display_name: "Mochi", role: "pet", status, profile_id: 3, joined_at: null, reports_against_count: 1 });
const post = { id: 1, type: "update" as const, title: null, body: "Hi", photos: [], is_removed: false, is_deleted: false, created_at: null };
const comment = { id: 2, body: "Hi", is_removed: false, created_at: null };
const about = (content: ReportDetail["content_preview"], status: ReportedAccount["status"] = "active") => actionOptionsFor({ content_preview: content, reported_user: account(status) }).map((option) => option.value);

describe("the report dialog (RP-01)", () => {
  it("lists every reason the API knows, selling or trading animals among them (SEC-ABUSE-02)", () => {
    expect(REPORT_REASON_OPTIONS.map((option) => option.value)).toEqual([...REPORT_REASONS]);
    expect(REPORT_REASON_OPTIONS.find((option) => option.value === "selling_or_trading_animals")?.label).toBe("Selling or trading animals");
  });

  it("needs a reason, and the details only for something else", () => {
    expect(reportProblems({ reason: null, details: "" })).toEqual({ reason: "Choose a reason." });
    expect(reportProblems({ reason: "status", details: "" })).toHaveProperty("reason");
    expect(reportProblems({ reason: "spam_or_scam", details: "" })).toEqual({});
    expect(reportProblems({ reason: "something_else", details: "   " })).toHaveProperty("details");
    expect(reportProblems({ reason: "something_else", details: "It names my street." })).toEqual({});
    expect(reportProblems({ reason: "spam_or_scam", details: "x".repeat(REPORT_DETAILS_MAX + 1) })).toHaveProperty("details");
  });

  it("names what is reported by its own id, and never whose it is for a post or a comment", () => {
    expect(reportTargetBody({ kind: "post", postId: 12, ownerName: "Mochi" })).toEqual({ target_type: "post", post_id: 12 });
    expect(reportTargetBody({ kind: "comment", commentId: 5, ownerName: "Mochi" })).toEqual({ target_type: "comment", comment_id: 5 });
    expect(reportTargetBody({ kind: "pet", petId: 3, ownerName: "Mochi" })).toEqual({ target_type: "profile", pet_id: 3 });
    expect(reportTargetBody({ kind: "home", homeProfileId: 4, ownerName: "Ana Santos" })).toEqual({ target_type: "profile", home_profile_id: 4 });
    expect(reportTargetBody({ kind: "account", accountId: 9, ownerName: "Mochi" })).toEqual({ target_type: "account", reported_user_id: 9 });
  });

  it("titles the dialog with what is being reported", () => {
    expect(reportTitle({ kind: "post", postId: 1, ownerName: "Mochi" })).toBe("Report Mochi’s post");
    expect(reportTitle({ kind: "home", homeProfileId: 1, ownerName: "Ana Santos" })).toBe("Report Ana Santos’s Home Profile");
  });
});

describe("the queue and the review (RP-03, RP-04)", () => {
  it("reads the tab and the report id from the address, and nothing else", () => {
    expect(reportTabFromUrl(undefined)).toBe("open");
    expect(reportTabFromUrl("resolved")).toBe("resolved");
    expect(reportTabFromUrl(["resolved", "open"])).toBe("resolved");
    expect(reportTabFromUrl("everything")).toBe("open");
    expect(reportIdFromUrl("42")).toBe(42);
    for (const bad of ["", "0", "04", "1.5", "-1", "..%2Faccounts", "1/actions", "abc"]) expect(reportIdFromUrl(bad)).toBeNull();
  });

  it("names a row by what was reported and whose it is", () => {
    expect(reportedItemName({ target_type: "post", reported_user: account("active") })).toBe("Post by Mochi");
    expect(reportedItemName({ target_type: "profile", reported_user: account("active") })).toBe("Mochi’s profile");
    expect(reportedItemName({ target_type: "account", reported_user: null })).toBe("An account that is gone");
  });
});

describe("the take action dialog (RP-05)", () => {
  it("offers every action on a post or a comment by an Active account", () => {
    expect(about({ post, comment: null })).toEqual(["remove_content", "suspend_account", "remove_content_and_suspend", "dismiss"]);
    expect(about({ post, comment })).toEqual(["remove_content", "suspend_account", "remove_content_and_suspend", "dismiss"]);
  });

  it("leaves out removing for a profile or an account, and for content that is already gone", () => {
    expect(about({ post: null, comment: null })).toEqual(["suspend_account", "dismiss"]);
    expect(about({ post: { ...post, is_removed: true }, comment: null })).toEqual(["suspend_account", "dismiss"]);
    expect(about({ post: { ...post, is_deleted: true }, comment: null })).toEqual(["suspend_account", "dismiss"]);
    // The comment is what was reported; its post being removed doesn't matter.
    expect(about({ post: { ...post, is_removed: true }, comment })).toContain("remove_content");
    expect(about({ post, comment: { ...comment, is_removed: true } })).toEqual(["suspend_account", "dismiss"]);
  });

  it("leaves out suspending for an account that isn't Active", () => {
    expect(about({ post, comment: null }, "suspended")).toEqual(["remove_content", "dismiss"]);
    expect(about({ post: null, comment: null }, "deactivated")).toEqual(["dismiss"]);
  });

  it("always needs an action and a reason", () => {
    expect(actionProblems({ action: null, reason: "" })).toEqual({ action: "Choose what to do.", reason: "Enter a reason for this moderation action." });
    expect(actionProblems({ action: "restore_everything", reason: "Because." })).toHaveProperty("action");
    expect(actionProblems({ action: "dismiss", reason: "   " })).toHaveProperty("reason");
    expect(actionProblems({ action: "dismiss", reason: "x".repeat(ACTION_REASON_MAX + 1) })).toHaveProperty("reason");
    expect(actionProblems({ action: "remove_content", reason: "Selling animals is not allowed." })).toEqual({});
  });
});
