import { describe, expect, it } from "vitest";
import { downloadActivityLogs, downloadMyActivity, getActivityLogEntry, getActivityLogs, getMyActivity, toActivityEntry } from "@/features/activity-logs/api/activity-logs";
import {
  ACTIVITY_TABS,
  actionLabel,
  activityTabFromUrl,
  byLine,
  exportFileName,
  logFiltersFromUrl,
  logQueryFor,
  logSummary,
  memberAboutLine,
  reasonText,
  typesForTab,
  valueLabel,
  valueStatus,
} from "@/features/activity-logs/schemas/activity-logs";
import { ACTIVITY_TYPES, type ActivityActor } from "@/features/activity-logs/types/activity-logs";
import { type Transport, createApiClient } from "@/lib/api/core";
import { isApiError } from "@/lib/api/errors";
import { MOCK_PERSONA_COOKIE, createMockTransport } from "@/lib/api/mock/transport";

// Activity logs (LG-01…LG-04): how the log is addressed, how an action, a value and a reason are put into words,
// what is read from the API's answer, and the calls against the mock API, which answers in the shapes of
// docs/api/community-reports-and-admin.md.

function as(persona: string) {
  return createApiClient(createMockTransport({ readCookie: (name) => (name === MOCK_PERSONA_COOKIE ? persona : null), writePersona: () => {}, latencyMs: 0 }));
}

function answering(body: unknown, status = 200) {
  const calls: { method: string; path: string; query?: unknown; responseType?: string }[] = [];
  const transport: Transport = async ({ method, path, query, responseType }) => {
    calls.push({ method, path, query, responseType });
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

const actor = (change: Partial<ActivityActor> = {}): ActivityActor => ({ id: null, display_name: "Ana Santos", role: "human", is_you: false, ...change });
const ROW = { id: 9, type: "request", action: "adoption_request_approved", actor: { display_name: "Ana Santos", role: "human", is_you: false }, subject_type: "AdoptionRequest", subject_label: "Mochi to Ana Santos", target: { kind: "request", id: 4 }, before_value: "sent", after_value: "approved", device: null, created_at: "2026-10-10T04:00:00.000000Z" };
const PAGE = { meta: { current_page: 1, last_page: 1, per_page: 20, total: 1, from: 1, to: 1, path: "" }, links: { first: null, last: null, prev: null, next: null } };

describe("the page's address", () => {
  it("reads a tab it knows and falls back to All", () => {
    expect(activityTabFromUrl("security")).toBe("security");
    expect(activityTabFromUrl(["requests", "feed"])).toBe("requests");
    expect(activityTabFromUrl("everything")).toBe("all");
    expect(activityTabFromUrl(undefined)).toBe("all");
  });

  it("turns a tab into the types the API lists", () => {
    expect(typesForTab("all")).toEqual([]);
    expect(typesForTab("requests")).toEqual(["request", "adoption"]);
    expect(typesForTab("account")).toEqual(["account", "verification", "moderation"]);
    // Every type a member can have is on some tab; announcements are an admin's.
    const onATab = new Set(ACTIVITY_TABS.flatMap((tab) => tab.types as readonly string[]));
    expect(ACTIVITY_TYPES.filter((type) => !onATab.has(type))).toEqual(["announcement"]);
  });

  it("reads the admin's filters and drops what the API doesn't know", () => {
    expect(logFiltersFromUrl({ actor: "admin", type: "moderation" })).toEqual({ actor: "admin", type: "moderation" });
    expect(logFiltersFromUrl({ actor: "", type: "" })).toEqual({ actor: undefined, type: undefined });
    expect(logFiltersFromUrl({ actor: "owner", type: "status_change; drop table" })).toEqual({ actor: undefined, type: undefined });
    expect(logFiltersFromUrl({ actor: ["system", "admin"] })).toEqual({ actor: "system", type: undefined });
  });

  it("writes the filters back as a query", () => {
    expect(logQueryFor({ actor: "admin", type: undefined })).toEqual({ actor: "admin" });
    expect(logQueryFor({ actor: undefined, type: "security" }, 3)).toEqual({ type: "security", page: "3" });
    expect(logQueryFor({ actor: undefined, type: undefined }, 1)).toEqual({});
  });
});

describe("words for the log", () => {
  it("names an action, and writes one it doesn't know from its own name", () => {
    expect(actionLabel({ action: "adoption_request_approved" })).toBe("Adoption request approved");
    expect(actionLabel({ action: "report_resolved_remove_content_and_suspend" })).toBe("Report resolved: content removed and account suspended");
    expect(actionLabel({ action: "pet_status_in_process" })).toBe("Pet status changed to In Process");
    expect(actionLabel({ action: "something_new_happened" })).toBe("Something new happened");
    expect(actionLabel({ action: "___" })).toBe("Activity");
  });

  it("names a status by the proposal's words and leaves other values as they are", () => {
    expect(valueLabel("looking_for_a_home")).toBe("Looking for a Home");
    expect(valueLabel("adopted_hired")).toBe("Hired");
    expect(valueLabel("pending_verification")).toBe("Pending Verification");
    expect(valueLabel("meet_scheduled")).toBe("Meet Scheduled");
    expect(valueLabel("booked")).toBe("Booked");
    expect(valueLabel("Ana Santos")).toBe("Ana Santos");
    expect(valueLabel("3 slot(s)")).toBe("3 slot(s)");
    expect(valueStatus("in_process")).toBe("In Process");
    expect(valueStatus("suspended")).toBe("Suspended");
    // Not a status the badges know: shown as text.
    expect(valueStatus("booked")).toBeNull();
    expect(valueStatus("Ana Santos")).toBeNull();
  });

  it("puts a kept name into words and leaves a person's own words alone", () => {
    expect(reasonText("fake_profile")).toBe("Fake profile");
    expect(reasonText("unreadable_id: The photo is too dark")).toBe("Unreadable id: The photo is too dark");
    expect(reasonText("Documents complete")).toBe("Documents complete");
    expect(reasonText("5 confirmed reports: fake profile")).toBe("5 confirmed reports: fake profile");
    expect(reasonText("other")).toBe("other");
    expect(reasonText("GET /api/v1/admin/accounts")).toBe("GET /api/v1/admin/accounts");
  });

  it("says who did it only when it wasn't the reader", () => {
    expect(byLine(actor({ is_you: true }))).toBeNull();
    expect(byLine(actor())).toBe("By Ana Santos");
    expect(byLine(actor({ role: "system", display_name: "System" }))).toBe("By the system");
    // A member is told an admin did it, never which one; an admin reads the name.
    expect(byLine(actor({ role: "admin", display_name: "An admin" }))).toBe("By an admin");
    expect(byLine(actor({ role: "admin", display_name: "admin.jess", id: 3 }))).toBe("By admin.jess");
  });

  it("names what a member's entry was about only when it is between two sides", () => {
    expect(memberAboutLine({ subject_type: "AdoptionRequest", subject_label: "Mochi to Ana Santos" })).toBe("Mochi to Ana Santos");
    expect(memberAboutLine({ subject_type: "MeetAndGreet", subject_label: "Mochi to Ana Santos" })).toBe("Mochi to Ana Santos");
    expect(memberAboutLine({ subject_type: "User", subject_label: "Mochi" })).toBeNull();
    expect(memberAboutLine({ subject_type: null, subject_label: null })).toBeNull();
  });

  it("sums up what the admin's table lists", () => {
    expect(logSummary(1, { actor: undefined, type: undefined })).toBe("1 entry");
    expect(logSummary(12, { actor: "admin", type: undefined })).toBe("12 entries by admins");
    expect(logSummary(3, { actor: "system", type: "status_change" })).toBe("3 entries by the system, type Status change");
  });

  it("names an export after the day in the Philippines", () => {
    // 5 PM UTC on Oct 9 is already Oct 10 in the Philippines.
    const now = new Date("2026-10-09T17:00:00.000Z");
    expect(exportFileName("mine", now)).toBe("pawfolio-my-activity-2026-10-10.csv");
    expect(exportFileName("all", now)).toBe("pawfolio-activity-logs-2026-10-10.csv");
  });
});

describe("reading what the API answered", () => {
  it("reads an entry, and what a member's doesn't carry as empty", () => {
    expect(toActivityEntry(ROW)).toEqual({
      id: 9,
      type: "request",
      action: "adoption_request_approved",
      actor: { id: null, display_name: "Ana Santos", role: "human", is_you: false },
      subject_type: "AdoptionRequest",
      subject_label: "Mochi to Ana Santos",
      target: { kind: "request", id: 4 },
      before_value: "sent",
      after_value: "approved",
      reason: null,
      device: null,
      created_at: "2026-10-10T04:00:00.000000Z",
    });
  });

  it("leaves out a row that isn't an entry", () => {
    expect(toActivityEntry({ ...ROW, type: "gossip" })).toBeNull();
    expect(toActivityEntry({ ...ROW, actor: { display_name: "Ana", role: "owner" } })).toBeNull();
    expect(toActivityEntry({ ...ROW, created_at: "yesterday" })).toBeNull();
    expect(toActivityEntry({ ...ROW, id: "9" })).toBeNull();
    expect(toActivityEntry(null)).toBeNull();
  });

  it("never guesses who did it or where it leads", () => {
    const entry = toActivityEntry({ ...ROW, actor: { role: "admin", is_you: "yes", id: "3" }, target: { kind: "post", id: 4 } });
    expect(entry?.actor).toEqual({ id: null, display_name: "An admin", role: "admin", is_you: false });
    expect(entry?.target).toBeNull();
    expect(toActivityEntry({ ...ROW, target: { kind: "account", id: -1 } })?.target).toBeNull();
  });

  it("asks for the types of a tab, the filters of the log and one entry by its id", async () => {
    const { client, calls } = answering({ data: [ROW], ...PAGE });
    await getMyActivity(client, { types: ["request", "adoption"], page: 2 });
    await getMyActivity(client);
    await getActivityLogs(client, { actor: "admin", type: "moderation", page: 1 });
    expect(calls.map(({ path, query }) => ({ path, query }))).toEqual([
      { path: "/activity", query: { type: "request,adoption", page: 2, per_page: undefined } },
      { path: "/activity", query: { type: undefined, page: undefined, per_page: undefined } },
      { path: "/admin/activity-logs", query: { type: "moderation", actor_role: "admin", page: undefined, per_page: undefined } },
    ]);

    const one = answering({ data: { ...ROW, user_agent: "Mozilla/5.0" } });
    expect((await getActivityLogEntry(one.client, 9)).user_agent).toBe("Mozilla/5.0");
    expect(one.calls[0].path).toBe("/admin/activity-logs/9");
  });

  it("refuses an answer that isn't a page or an entry", async () => {
    expect((await failure(() => getMyActivity(answering({ data: "nope" }).client))).message).toBe("We couldn't load your activity. Please try again.");
    expect((await failure(() => getActivityLogs(answering({ data: [ROW] }).client))).message).toBe("We couldn't load the activity logs. Please try again.");
    expect((await failure(() => getActivityLogEntry(answering({ data: { id: 9 } }).client, 9))).message).toBe("We couldn't load this entry. Please try again.");
  });

  it("accepts a CSV for an export and nothing else", async () => {
    const csv = answering(new Blob(["When,Who\n"], { type: "text/csv; charset=UTF-8" }));
    const file = await downloadMyActivity(csv.client, ["security"]);
    expect(file.type).toBe("text/csv");
    expect(csv.calls[0]).toEqual({ method: "GET", path: "/activity/export", query: { type: "security" }, responseType: "blob" });

    await downloadActivityLogs(csv.client, { actor: "system", type: undefined });
    expect(csv.calls[1]).toMatchObject({ path: "/admin/activity-logs/export", query: { type: undefined, actor_role: "system" } });

    // A page dressed up as an export is never handed to the browser (SEC-FE-09).
    const html = answering(new Blob(["<script>alert(1)</script>"], { type: "text/html" }));
    expect((await failure(() => downloadMyActivity(html.client))).message).toBe("We couldn't open that file.");
  });
});

describe("against the mock API", () => {
  it("lists a member's own activity, newest first, without reasons or an admin's name", async () => {
    const page = await getMyActivity(as("pet"));
    expect(page.data.length).toBeGreaterThan(5);
    expect(page.data.map((entry) => Date.parse(entry.created_at))).toEqual([...page.data.map((entry) => Date.parse(entry.created_at))].sort((a, b) => b - a));
    expect(page.data.every((entry) => entry.reason === null && entry.actor.id === null)).toBe(true);
    const approved = page.data.find((entry) => entry.action === "account_approved");
    expect(approved?.actor).toEqual({ id: null, display_name: "An admin", role: "admin", is_you: false });
    expect(approved?.target).toBeNull();
    // Nothing of another account's, and nothing about a report.
    expect(page.data.some((entry) => entry.action === "password_changed" || entry.type === "moderation")).toBe(false);
    expect(page.data.find((entry) => entry.action === "signed_in")?.device).toBe("Edge on Windows");
  });

  it("narrows a member's activity by a tab's types", async () => {
    const requests = await getMyActivity(as("human"), { types: typesForTab("requests") });
    expect(requests.data.map((entry) => entry.action)).toEqual(["adoption_request_approved", "adoption_request_sent"]);
    expect(requests.data[0].actor.is_you).toBe(true);
    expect(requests.data[1].target).toEqual({ kind: "request", id: 1 });
    expect((await getMyActivity(as("human"), { types: typesForTab("feed") })).data.map((entry) => entry.action)).toEqual(["post_created"]);
  });

  it("lists every entry whole for an admin, and narrows it", async () => {
    const all = await getActivityLogs(as("admin"), { perPage: 50 });
    expect(all.meta.total).toBeGreaterThan(20);
    const suspended = all.data.find((entry) => entry.action === "account_suspended");
    expect(suspended).toMatchObject({ reason: "5 confirmed reports: fake profile", actor: { id: 3, display_name: "admin.jess", is_you: true }, target: { kind: "account", id: 6 } });

    const system = await getActivityLogs(as("admin"), { actor: "system" });
    expect(system.data.every((entry) => entry.actor.role === "system")).toBe(true);
    const moderation = await getActivityLogs(as("admin"), { actor: "admin", type: "moderation" });
    expect(moderation.data.map((entry) => entry.action)).toEqual(["report_resolved_remove_content"]);
  });

  it("opens one entry with the device it came from", async () => {
    const entry = await getActivityLogEntry(as("admin"), 1);
    expect(entry).toMatchObject({ action: "signed_up", device: "Edge on Windows" });
    expect(entry.user_agent).toContain("Edg/");
    expect((await failure(() => getActivityLogEntry(as("admin"), 9999))).kind).toBe("not_found");
  });

  it("keeps the platform's log to admins and every list to signed-in Active accounts", async () => {
    expect((await failure(() => getActivityLogs(as("pet")))).status).toBe(403);
    expect((await failure(() => getActivityLogEntry(as("human"), 1))).status).toBe(403);
    expect((await failure(() => downloadActivityLogs(as("pet")))).status).toBe(403);
    expect((await failure(() => getMyActivity(as("signed-out")))).status).toBe(401);
    expect((await failure(() => getMyActivity(as("pet-pending")))).kind).toBe("account_not_active");
  });

  it("downloads what each reader may see", async () => {
    const mine = await (await downloadMyActivity(as("pet"))).text();
    expect(mine.split("\n")[0]).toBe('"When (Philippine time)",Who,Type,Action,About,Before,After,Device');
    expect(mine).toContain('"An admin",verification,account_approved');
    expect(mine).not.toContain("admin.jess");
    expect(mine).not.toContain("Documents complete");

    const all = await (await downloadActivityLogs(as("admin"), { actor: "admin", type: undefined })).text();
    expect(all.split("\n")[0]).toBe('"When (Philippine time)",Who,Type,Action,About,Before,After,Reason,Device');
    expect(all).toContain('admin.jess,verification,account_approved,Mochi,pending_verification,active,"Documents complete"');
    expect(all).not.toContain("adoption_request_sent");
  });
});
