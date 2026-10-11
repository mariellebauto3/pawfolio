import { describe, expect, it } from "vitest";
import { getNotifications } from "@/features/notifications/api/notifications";
import { groupByAge, notificationCount, notificationPeriodFromUrl } from "@/features/notifications/schemas/history";
import { notificationsHref } from "@/features/notifications/schemas/tabs";
import { createApiClient } from "@/lib/api/core";
import { MOCK_PERSONA_COOKIE, createMockTransport } from "@/lib/api/mock/transport";

// The Notifications page as a history (NT-02, NT-03): old notifications are kept, listed under the heading their
// age gives them, and "Earlier" goes straight to them.

const row = (id: string, created_at: string) => ({ id, created_at });
const at = (row: { created_at: string }) => row.created_at;
// 10:30 in the morning of Saturday 10 October 2026 in the Philippines.
const NOW = new Date("2026-10-10T02:30:00Z");

describe("sections by age", () => {
  it("puts each notification under today, yesterday, this week, this month or its own month, however old", () => {
    const groups = groupByAge(
      [
        row("a", "2026-10-10T01:00:00Z"),
        row("b", "2026-10-09T17:00:00Z"), // 1:00 on the 10th in the Philippines: still today
        row("c", "2026-10-09T03:00:00Z"),
        row("d", "2026-10-05T03:00:00Z"),
        row("e", "2026-10-02T03:00:00Z"),
        row("f", "2026-09-28T03:00:00Z"),
        row("g", "2026-09-01T03:00:00Z"),
        row("h", "2024-03-15T03:00:00Z"),
      ],
      at,
      NOW,
    );
    expect(groups.map((group) => [group.heading, group.rows.map((r) => r.id).join("")])).toEqual([
      ["Today", "ab"],
      ["Yesterday", "c"],
      ["This week", "d"],
      ["Earlier this month", "e"],
      ["September 2026", "fg"],
      ["March 2024", "h"],
    ]);
    expect(new Set(groups.map((group) => group.id)).size).toBe(groups.length);
  });

  it("counts days by the Philippine calendar, not by 24 hours", () => {
    // 23:30 on the 9th in the Philippines is yesterday, though only 11 hours ago.
    expect(groupByAge([row("a", "2026-10-09T15:30:00Z")], at, NOW)[0].heading).toBe("Yesterday");
    // "This week" ends where the API's "recent" does: 7 days ago to the minute.
    expect(groupByAge([row("a", "2026-10-03T03:00:00Z")], at, NOW)[0].heading).toBe("This week");
    expect(groupByAge([row("a", "2026-10-03T02:00:00Z")], at, NOW)[0].heading).toBe("Earlier this month");
  });

  it("keeps a row whose date can't be read, with the rows before it", () => {
    expect(groupByAge([row("a", "2026-10-10T01:00:00Z"), row("b", "soon")], at, NOW)).toEqual([{ id: "today", heading: "Today", rows: [row("a", "2026-10-10T01:00:00Z"), row("b", "soon")] }]);
    expect(groupByAge([row("b", "soon")], at, NOW)[0].heading).toBe("Earlier");
    expect(groupByAge([], at, NOW)).toEqual([]);
  });
});

describe("the period in the address", () => {
  it("reads all, recent or earlier, and anything else as all", () => {
    expect(notificationPeriodFromUrl("earlier")).toBe("earlier");
    expect(notificationPeriodFromUrl(["recent", "earlier"])).toBe("recent");
    for (const value of [undefined, "", "all", "Earlier", "2020", "../admin"]) expect(notificationPeriodFromUrl(value)).toBe("all");
  });

  it("is written without the defaults, and never on Announcements", () => {
    expect(notificationsHref("all", 1, "earlier")).toBe("/notifications?when=earlier");
    expect(notificationsHref("requests", 3, "earlier")).toBe("/notifications?tab=requests&when=earlier&page=3");
    expect(notificationsHref("account", 1, "all")).toBe("/notifications?tab=account");
    expect(notificationsHref("announcements", 1, "earlier")).toBe("/notifications?tab=announcements");
  });

  it("says how many there are, and which ones a page shows", () => {
    expect(notificationCount({ total: 1, from: 1, to: 1 })).toBe("1 notification");
    expect(notificationCount({ total: 8, from: 1, to: 8 })).toBe("8 notifications");
    expect(notificationCount({ total: 134, from: 21, to: 40 })).toBe("Showing 21 to 40 of 134 notifications");
  });
});

describe("against the mock API", () => {
  const client = createApiClient(createMockTransport({ readCookie: (name) => (name === MOCK_PERSONA_COOKIE ? "pet" : null), writePersona: () => {}, latencyMs: 0 }));
  const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

  it("lists every notification, and the recent and the earlier ones apart", async () => {
    const all = await getNotifications(client);
    const recent = await getNotifications(client, { period: "recent" });
    const earlier = await getNotifications(client, { period: "earlier" });

    expect(earlier.meta.total).toBeGreaterThan(0);
    expect(recent.meta.total + earlier.meta.total).toBe(all.meta.total);
    for (const item of recent.data) expect(Date.now() - Date.parse(item.created_at)).toBeLessThanOrEqual(WEEK_MS);
    for (const item of earlier.data) expect(Date.now() - Date.parse(item.created_at)).toBeGreaterThan(WEEK_MS - 1000);
  });

  it("refuses a period that isn't one", async () => {
    await expect(getNotifications(client, { period: "someday" as "recent" })).rejects.toMatchObject({ kind: "validation", fieldErrors: { period: "Choose All, Recent or Earlier." } });
  });
});
