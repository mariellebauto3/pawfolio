import { describe, expect, it } from "vitest";
import { getOpenReportCount, getReport, getReports, submitReport, takeReportAction, toReportSummary } from "@/features/reports/api/reports";
import { type Transport, createApiClient } from "@/lib/api/core";
import { isApiError } from "@/lib/api/errors";
import { MOCK_PERSONA_COOKIE, createMockTransport } from "@/lib/api/mock/transport";

// The reports calls against the mock API, which answers in the shapes of docs/api/community-reports-and-admin.md.
// The mock keeps what is filed and decided in memory for the whole file, so the tests that change it come last.
function as(persona: string) {
  return createApiClient(createMockTransport({ readCookie: (name) => (name === MOCK_PERSONA_COOKIE ? persona : null), writePersona: () => {}, latencyMs: 0 }));
}

/** A client whose API answers every call with `body` and `status`, and remembers what it was asked. */
function answering(body: unknown, status = 200) {
  const calls: { method: string; path: string; body?: unknown; query?: unknown }[] = [];
  const transport: Transport = async ({ method, path, body: sent, query }) => {
    calls.push({ method, path, body: sent, query });
    return { status, body, retryAfter: null };
  };
  return { client: createApiClient(transport), calls };
}

const failure = async (run: () => Promise<unknown>) => {
  try {
    await run();
  } catch (problem) {
    if (isApiError(problem)) return problem;
    throw problem;
  }
  throw new Error("Expected the call to fail.");
};

const ROW = {
  id: 9,
  target_type: "post",
  reason: "spam_or_scam",
  details: null,
  status: "open",
  reports_count: 2,
  post_id: 4,
  comment_id: null,
  reporter: { id: 2, display_name: "Ana Santos", role: "human" },
  reported_user: { id: 7, display_name: "Mochi", role: "pet", status: "active", profile_id: 3 },
  report_action: null,
  created_at: "2026-10-09T02:00:00.000000Z",
};
const META = { total: 1, current_page: 1, last_page: 1 };

describe("reading what the API answers", () => {
  it("keeps a report that matches the contract", () => {
    expect(toReportSummary(ROW)).toMatchObject({ id: 9, status: "open", reports_count: 2, reported_user: { status: "active", joined_at: null, reports_against_count: null } });
  });

  it("refuses a row whose status, target or reason it doesn't know, since the screen picks its actions from them", () => {
    expect(toReportSummary({ ...ROW, status: "escalated" })).toBeNull();
    expect(toReportSummary({ ...ROW, target_type: "message" })).toBeNull();
    expect(toReportSummary({ ...ROW, reason: "boring" })).toBeNull();
    expect(toReportSummary({ ...ROW, id: "9" })).toBeNull();
    expect(toReportSummary(null)).toBeNull();
  });

  it("leaves a broken row out of the queue and refuses an answer that isn't a page", async () => {
    const { client } = answering({ data: [ROW, { ...ROW, id: 10, status: "escalated" }], meta: META, links: {} });
    expect((await getReports(client)).data.map((report) => report.id)).toEqual([9]);
    expect((await failure(() => getReports(answering({ data: "nope" }).client))).kind).toBe("server");
  });

  it("reads removed content strictly: only `true` offers Restore", async () => {
    const preview = { post: { id: 4, type: "update", title: null, body: "Hi", photos: [{ id: 1, url: "/storage/a.jpg" }, { url: 5 }], is_removed: "yes" }, comment: null };
    const report = await getReport(answering({ data: { ...ROW, content_preview: preview, sibling_reports: [{ id: 9, reporter_name: "Ana Santos", reason: "spam_or_scam", details: null, status: "open", created_at: ROW.created_at }, { id: "x" }] } }).client, 9);
    expect(report.content_preview.post).toMatchObject({ is_removed: false, is_deleted: false, photos: [{ id: 1, url: "/storage/a.jpg" }] });
    expect(report.sibling_reports).toHaveLength(1);
  });
});

describe("what is sent", () => {
  it("files a report with its target, reason and details, and nothing about who or what status", async () => {
    const { client, calls } = answering({ data: { id: 3, status: "open" } }, 201);
    await submitReport(client, { kind: "comment", commentId: 5, ownerName: "Mochi" }, { reason: "harassment_or_hate", details: null });
    expect(calls).toEqual([{ method: "POST", path: "/reports", body: { target_type: "comment", comment_id: 5, reason: "harassment_or_hate", details: null }, query: undefined }]);
  });

  it("asks for one tab of the queue, and for one row to count what is open", async () => {
    const { client, calls } = answering({ data: [], meta: { ...META, total: 7 }, links: {} });
    await getReports(client, { status: "resolved", page: 2 });
    expect(await getOpenReportCount(client)).toBe(7);
    expect(calls.map((call) => call.query)).toEqual([
      { status: "resolved", page: 2, per_page: undefined },
      { status: "open", page: undefined, per_page: 1 },
    ]);
  });

  it("sends an action with its reason, and a restore without the reporters' switch", async () => {
    const { client, calls } = answering({ data: { ...ROW, status: "resolved" } });
    await takeReportAction(client, 9, { action: "dismiss", reason: "No violation.", notify_reporters: false });
    await takeReportAction(client, 9, { action: "restore_content", reason: "Removed by mistake." });
    expect(calls.map((call) => [call.path, call.body])).toEqual([
      ["/admin/reports/9/actions", { action: "dismiss", reason: "No violation.", notify_reporters: false }],
      ["/admin/reports/9/actions", { action: "restore_content", reason: "Removed by mistake." }],
    ]);
  });
});

describe("the gates (mock API)", () => {
  it("answers the own-content refusal under target_id, where the dialog reads it", async () => {
    // Post 4 on the mock feed is Mochi's own update.
    const problem = await failure(() => submitReport(as("pet"), { kind: "post", postId: 4, ownerName: "Mochi" }, { reason: "spam_or_scam", details: null }));
    expect(problem.kind).toBe("validation");
    expect(problem.fieldErrors.target_id).toBe("You cannot report your own content or account.");
  });

  it("refuses a signed-out visitor, an account that isn't Active, and a member on the admin queue", async () => {
    const report = (persona: string) => failure(() => submitReport(as(persona), { kind: "post", postId: 5, ownerName: "Ana Santos" }, { reason: "spam_or_scam", details: null }));
    expect((await report("signed-out")).kind).toBe("unauthenticated");
    expect((await report("pet-suspended")).kind).toBe("account_not_active");
    expect((await failure(() => getReports(as("human")))).kind).toBe("forbidden");
    expect((await failure(() => takeReportAction(as("pet"), 1, { action: "dismiss", reason: "Mine." }))).kind).toBe("forbidden");
  });

  it("needs the details for something else, and a post that exists", async () => {
    const pet = as("pet");
    expect((await failure(() => submitReport(pet, { kind: "post", postId: 5, ownerName: "Ana Santos" }, { reason: "something_else", details: null }))).fieldErrors.details).toBeTruthy();
    expect((await failure(() => submitReport(pet, { kind: "post", postId: 999, ownerName: "Nobody" }, { reason: "spam_or_scam", details: null }))).kind).toBe("not_found");
  });
});

describe("the queue and the actions (mock API, in order)", () => {
  const admin = as("admin");

  it("lists one row per reported item, most reported first", async () => {
    const open = await getReports(admin);
    expect(open.data.map((report) => [report.reports_count, report.target_type])).toEqual([
      [3, "post"],
      [1, "comment"],
      [1, "profile"],
    ]);
    // The item's latest report stands for the row.
    expect(open.data[0]).toMatchObject({ id: 3, reason: "spam_or_scam", reporter: { display_name: "Paolo Garcia" }, reported_user: { display_name: "Bruno" } });
    expect(await getOpenReportCount(admin)).toBe(3);

    const resolved = await getReports(admin, { status: "resolved" });
    expect(resolved.data).toHaveLength(1);
    expect(resolved.data[0].report_action).toMatchObject({ action: "dismiss", performed_by: "admin.mark" });
  });

  it("shows the content, every report on it and the account", async () => {
    const report = await getReport(admin, 1);
    expect(report.content_preview.post?.body).toContain("₱5,000");
    expect(report.sibling_reports.map((item) => item.id)).toEqual([3, 2, 1]);
    expect(report.reported_user).toMatchObject({ display_name: "Bruno", status: "active", reports_against_count: 3 });
    expect((await failure(() => getReport(admin, 999))).kind).toBe("not_found");
  });

  it("files a member's report once, and tells them when they report it again", async () => {
    const human = as("human");
    const target = { kind: "post", postId: 4, ownerName: "Mochi" } as const;
    expect((await submitReport(human, target, { reason: "spam_or_scam", details: "  Twice a day.  " })).status).toBe("open");
    const again = await failure(() => submitReport(human, target, { reason: "harassment_or_hate", details: null }));
    expect([again.kind, again.code]).toEqual(["conflict", "report_already_open"]);
    expect(await getOpenReportCount(admin)).toBe(4);
  });

  it("refuses to remove a profile, and an action without a reason", async () => {
    expect((await failure(() => takeReportAction(admin, 5, { action: "remove_content", reason: "Stock photos." }))).fieldErrors.action).toBeTruthy();
    expect((await failure(() => takeReportAction(admin, 1, { action: "remove_content", reason: "   " }))).fieldErrors.reason).toBeTruthy();
    expect((await failure(() => takeReportAction(admin, 1, { action: "restore_content", reason: "Nothing removed." }))).code).toBe("nothing_to_restore");
  });

  it("removes and suspends once, resolving every open report on the item, and restores what was removed", async () => {
    const resolved = await takeReportAction(admin, 1, { action: "remove_content_and_suspend", reason: "Selling animals is not allowed on Pawfolio." });
    expect(resolved).toMatchObject({ status: "resolved", reports_count: 3, report_action: { action: "remove_content_and_suspend", performed_by: "admin.jess" }, reported_user: { status: "suspended" } });
    expect(resolved.content_preview.post?.is_removed).toBe(true);
    expect(resolved.sibling_reports.every((item) => item.status === "resolved")).toBe(true);

    const late = await failure(() => takeReportAction(admin, 2, { action: "dismiss", reason: "Looked fine." }));
    expect([late.kind, late.code]).toEqual(["conflict", "report_already_resolved"]);

    const restored = await takeReportAction(admin, 1, { action: "restore_content", reason: "Removed by mistake." });
    expect(restored.status).toBe("resolved");
    expect(restored.content_preview.post?.is_removed).toBe(false);
  });
});
