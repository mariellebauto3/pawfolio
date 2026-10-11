import { describe, expect, it } from "vitest";
import { getAnnouncements, getPublishedAnnouncements, publishAnnouncement, toAnnouncement } from "@/features/notifications/api/announcements";
import {
  type AnnouncementDraft,
  EMPTY_DRAFT,
  announcementErrorsFromApi,
  announcementMeta,
  audienceHint,
  audienceLine,
  readAnnouncementDraft,
  storedToast,
} from "@/features/notifications/schemas/announcements";
import type { AdminAnnouncement } from "@/features/notifications/types/announcements";
import { type Transport, createApiClient } from "@/lib/api/core";
import { isApiError } from "@/lib/api/errors";
import { MOCK_PERSONA_COOKIE, createMockTransport } from "@/lib/api/mock/transport";

// The admin's announcements (NT-04, NT-05): the form's rules, how an audience, a time and a result are put into
// words, and the calls against the mock API, which answers in the shapes of
// docs/api/community-reports-and-admin.md. The mock keeps what is published in memory, so the tests that publish
// come last.

function as(persona: string) {
  return createApiClient(createMockTransport({ readCookie: (name) => (name === MOCK_PERSONA_COOKIE ? persona : null), writePersona: () => {}, latencyMs: 0 }));
}

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

// 12:00 noon in the Philippines on Oct 10.
const NOW = new Date("2026-10-10T04:00:00.000Z");
const draft = (change: Partial<AnnouncementDraft> = {}): AnnouncementDraft => ({ ...EMPTY_DRAFT, title: "Adoption Week starts Oct 10", message: "Shelters and fosters are featured all week.", ...change });
const ROW: AdminAnnouncement = { id: 3, title: "Adoption Week starts Oct 10", message: "Shelters and fosters are featured all week.", audience: "everyone", status: "published", publish_at: "2026-10-10T02:00:00.000000Z", published_at: "2026-10-10T02:00:00.000000Z", admin_name: "admin.jess", created_at: "2026-10-10T02:00:00.000000Z" };

describe("the form's rules", () => {
  it("reads a draft to publish now, trimmed, with no time", () => {
    expect(readAnnouncementDraft(draft({ title: "  Adoption Week starts Oct 10 ", audience: "pets" }), NOW)).toEqual({
      announcement: { title: "Adoption Week starts Oct 10", message: "Shelters and fosters are featured all week.", audience: "pets", publish_at: null },
    });
    // A day and a time left in the fields don't schedule anything while "Now" is chosen.
    expect(readAnnouncementDraft(draft({ when: "now", date: "2026-10-12", time: "10:00" }), NOW)).toMatchObject({ announcement: { publish_at: null } });
  });

  it("asks for a title and a message, within their limits", () => {
    expect(readAnnouncementDraft(draft({ title: "   ", message: "" }), NOW)).toEqual({ errors: { title: "Enter a title.", message: "Enter a message." } });
    expect(readAnnouncementDraft(draft({ title: "a".repeat(161), message: "b".repeat(2001) }), NOW)).toEqual({
      errors: { title: "Keep the title to 160 characters or fewer.", message: "Keep the message to 2000 characters or fewer." },
    });
    expect("announcement" in readAnnouncementDraft(draft({ title: "a".repeat(160), message: "b".repeat(2000) }), NOW)).toBe(true);
  });

  it("schedules in Philippine time, and only for a time still ahead", () => {
    // 10:00 AM in the Philippines is 02:00 UTC.
    expect(readAnnouncementDraft(draft({ when: "later", date: "2026-10-12", time: "10:00" }), NOW)).toMatchObject({ announcement: { publish_at: "2026-10-12T02:00:00.000Z" } });

    expect(readAnnouncementDraft(draft({ when: "later" }), NOW)).toEqual({ errors: { date: "Choose a date.", time: "Choose a time." } });
    expect(readAnnouncementDraft(draft({ when: "later", date: "2026-10-10", time: "11:59" }), NOW)).toEqual({ errors: { time: "Choose a time that is still ahead, or publish now." } });
    expect(readAnnouncementDraft(draft({ when: "later", date: "2027-10-11", time: "12:00" }), NOW)).toEqual({ errors: { date: "Choose a time within the next year." } });
    expect(readAnnouncementDraft(draft({ when: "later", date: "2026-02-30", time: "10:00" }), NOW)).toEqual({ errors: { date: "Enter a valid date and time." } });
  });

  it("puts the API's refusal of the time under the time field", () => {
    expect(announcementErrorsFromApi({ publish_at: "Choose a time that is still ahead, or publish now.", title: "Enter a title." })).toEqual({
      title: "Enter a title.",
      message: undefined,
      audience: undefined,
      time: "Choose a time that is still ahead, or publish now.",
    });
  });
});

describe("in words", () => {
  it("names an audience with how many Active accounts it is, when the API said", () => {
    expect(audienceLine("everyone", { everyone: 42 })).toBe("Everyone (42 Active accounts)");
    expect(audienceLine("pets", { pets: 1 })).toBe("Pets only (1 Active account)");
    expect(audienceLine("humans", {})).toBe("Humans only");
    expect(audienceHint("humans", {})).toBe("");
    expect(audienceHint("humans", { humans: 0 })).toBe("No Active account is in this audience right now.");
    expect(audienceHint("everyone", { everyone: 42 })).toContain("42 Active accounts right now");
  });

  it("confirms with what the API stored", () => {
    expect(storedToast({ ...ROW, recipients_notified: 42 })).toBe("Announcement published. 42 accounts were notified.");
    expect(storedToast({ ...ROW, recipients_notified: 1 })).toBe("Announcement published. 1 account was notified.");
    expect(storedToast({ ...ROW, recipients_notified: null })).toBe("Announcement published.");
    expect(storedToast({ ...ROW, status: "scheduled", published_at: null, publish_at: "2026-10-12T02:00:00.000Z", recipients_notified: 0 })).toBe("Announcement scheduled for Mon, Oct 12, 10:00 AM.");
  });

  it("says when, to whom and by whom", () => {
    expect(announcementMeta(ROW)).toBe("Oct 10, 2026, 10:00 AM, Everyone, by admin.jess");
    expect(announcementMeta({ ...ROW, status: "scheduled", published_at: null, publish_at: "2026-10-12T02:00:00.000Z", audience: "pets", admin_name: null })).toBe("Oct 12, 2026, 10:00 AM, Pets only");
  });
});

describe("reading what the API answers", () => {
  it("keeps an announcement that matches the contract and leaves out one the screen can't place", () => {
    expect(toAnnouncement(ROW)).toEqual(ROW);
    expect(toAnnouncement({ ...ROW, status: "draft" })).toBeNull();
    expect(toAnnouncement({ ...ROW, audience: "admins" })).toBeNull();
    expect(toAnnouncement({ ...ROW, title: 5 })).toBeNull();
    expect(toAnnouncement({ ...ROW, admin_name: " ", publish_at: "soon" })).toMatchObject({ admin_name: null, publish_at: null });
  });

  it("reads the audience counts strictly", async () => {
    const page = await getAnnouncements(answering({ data: [ROW, { id: 4 }], meta: { total: 2, current_page: 1, last_page: 1, audience_counts: { everyone: 42, pets: "27", humans: -1 } }, links: {} }).client);
    expect(page.data).toHaveLength(1);
    expect(page.audienceCounts).toEqual({ everyone: 42 });
    expect((await failure(() => getAnnouncements(answering({ data: "nope" }).client))).kind).toBe("server");
  });
});

describe("what is sent", () => {
  it("sends the title, the message, the audience and the time, and nothing about who or what status", async () => {
    const { client, calls } = answering({ data: { ...ROW, recipients_notified: 42 } }, 201);
    const stored = await publishAnnouncement(client, { title: "Adoption Week starts Oct 10", message: "Shelters and fosters are featured all week.", audience: "everyone", publish_at: null });
    expect(calls[0]).toEqual({ method: "POST", path: "/admin/announcements", body: { title: "Adoption Week starts Oct 10", message: "Shelters and fosters are featured all week.", audience: "everyone", publish_at: undefined }, query: undefined });
    expect(stored.recipients_notified).toBe(42);

    await publishAnnouncement(client, { title: "t", message: "m", audience: "pets", publish_at: "2026-10-12T02:00:00.000Z" });
    expect(calls[1].body).toEqual({ title: "t", message: "m", audience: "pets", publish_at: "2026-10-12T02:00:00.000Z" });

    // An answer that isn't an announcement is not one we can say was published.
    expect((await failure(() => publishAnnouncement(answering({ data: { id: 1 } }, 201).client, { title: "t", message: "m", audience: "pets", publish_at: null }))).kind).toBe("server");
  });

  it("asks for a page of the list", async () => {
    const { client, calls } = answering({ data: [], meta: { total: 0, current_page: 1, last_page: 1 }, links: {} });
    await getAnnouncements(client, 2, 10);
    await getAnnouncements(client);
    expect(calls[0]).toMatchObject({ method: "GET", path: "/admin/announcements", query: { page: 2, per_page: 10 } });
    expect(calls[1].query).toMatchObject({ page: undefined });
  });
});

describe("the announcements a member reads on Notifications", () => {
  it("lists what was published for the account's own role, newest first, without the admin's name", async () => {
    const forPets = await getPublishedAnnouncements(as("pet"));
    expect(forPets.data.map((row) => row.title)).toEqual(["Pawfolio Adoption Week starts Oct 10!", "Reminder: keep vet records up to date"]);
    expect(Object.keys(forPets.data[0]).sort()).toEqual(["id", "message", "published_at", "title"]);

    const forHumans = await getPublishedAnnouncements(as("human"));
    expect(forHumans.data.map((row) => row.title)).toEqual(["Pawfolio Adoption Week starts Oct 10!", "Meet & Greet availability is live"]);
  });

  it("is for signed-in Active accounts", async () => {
    expect((await failure(() => getPublishedAnnouncements(as("signed-out")))).kind).toBe("unauthenticated");
    expect((await failure(() => getPublishedAnnouncements(as("pet-pending")))).kind).toBe("account_not_active");
  });

  it("asks for a page, and leaves out a row that doesn't match the contract", async () => {
    const meta = { total: 2, current_page: 2, last_page: 2 };
    const { client, calls } = answering({ data: [{ id: 4, title: "Kept", message: "Hello", published_at: "not a date" }, { id: "5", title: "Dropped" }], meta });
    const page = await getPublishedAnnouncements(client, 2);
    expect(calls[0]).toMatchObject({ method: "GET", path: "/announcements", query: { page: 2, per_page: 20 } });
    expect(page.data).toEqual([{ id: 4, title: "Kept", message: "Hello", published_at: null }]);
  });
});

describe("against the mock API", () => {
  it("is for admins only", async () => {
    expect((await failure(() => getAnnouncements(as("pet")))).status).toBe(403);
    expect((await failure(() => publishAnnouncement(as("human"), { title: "t", message: "m", audience: "everyone", publish_at: null }))).status).toBe(403);
  });

  it("lists what was published, newest first, with the audience counts", async () => {
    const page = await getAnnouncements(as("admin"));
    expect(page.data.map((row) => row.title)).toEqual(["Pawfolio Adoption Week starts Oct 10!", "Meet & Greet availability is live", "Reminder: keep vet records up to date"]);
    expect(page.data.every((row) => row.status === "published")).toBe(true);
    const { everyone = 0, pets = 0, humans = 0 } = page.audienceCounts;
    expect(everyone).toBeGreaterThan(0);
    expect(pets + humans).toBe(everyone);
  });

  it("refuses what the API refuses, publishes now, and schedules for a time still ahead", async () => {
    const admin = as("admin");
    expect((await failure(() => publishAnnouncement(admin, { title: " ", message: "", audience: "everyone", publish_at: null }))).fieldErrors).toMatchObject({ title: "Enter a title.", message: "Enter a message." });
    expect((await failure(() => publishAnnouncement(admin, { title: "t", message: "m", audience: "everyone", publish_at: "2020-01-01T00:00:00.000Z" }))).fieldErrors.publish_at).toBe("Choose a time that is still ahead, or publish now.");

    const published = await publishAnnouncement(admin, { title: "Site maintenance on Sunday", message: "Pawfolio will be offline from 2 to 3 AM.", audience: "everyone", publish_at: null });
    expect(published).toMatchObject({ status: "published", admin_name: "admin.jess" });
    expect(published.recipients_notified).toBeGreaterThan(0);

    const at = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
    const scheduled = await publishAnnouncement(admin, { title: "New: stats page", message: "See your profile views.", audience: "pets", publish_at: at });
    expect(scheduled).toMatchObject({ status: "scheduled", published_at: null, publish_at: at, recipients_notified: 0 });

    const page = await getAnnouncements(admin);
    expect(page.data.slice(0, 2).map((row) => [row.title, row.status])).toEqual([
      ["New: stats page", "scheduled"],
      ["Site maintenance on Sunday", "published"],
    ]);
    expect(page.meta.total).toBe(5);
  });
});
