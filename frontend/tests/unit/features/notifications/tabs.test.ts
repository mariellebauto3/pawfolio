import { describe, expect, it } from "vitest";
import { NOTIFICATION_TABS, categoryForTab, notificationTabFromUrl, notificationsHref } from "@/features/notifications/schemas/tabs";

describe("the tabs of the Notifications page (NT-02, NT-03)", () => {
  it("are All, Requests, Meet & Greets and Account, as in the LoFi, and then Announcements", () => {
    expect(NOTIFICATION_TABS.map((tab) => tab.label)).toEqual(["All", "Requests", "Meet & Greets", "Account", "Announcements"]);
  });

  it("reads the tab from the URL, and anything else as All", () => {
    expect(notificationTabFromUrl("requests")).toBe("requests");
    expect(notificationTabFromUrl("meet-and-greets")).toBe("meet-and-greets");
    expect(notificationTabFromUrl(["account", "requests"])).toBe("account");
    expect(notificationTabFromUrl("announcements")).toBe("announcements");
    for (const value of [undefined, "", "all", "feed", "meet_and_greets", "Requests", "../admin"]) {
      expect(notificationTabFromUrl(value)).toBe("all");
    }
  });

  it("asks the API for the tab's category, and for none on All or on Announcements, which is a list of its own", () => {
    expect(NOTIFICATION_TABS.map((tab) => categoryForTab(tab.id))).toEqual([undefined, "requests", "meet_and_greets", "account", undefined]);
  });

  it("writes a tab's address without the defaults", () => {
    expect(notificationsHref("all")).toBe("/notifications");
    expect(notificationsHref("all", 3)).toBe("/notifications?page=3");
    expect(notificationsHref("meet-and-greets")).toBe("/notifications?tab=meet-and-greets");
    expect(notificationsHref("account", 2)).toBe("/notifications?tab=account&page=2");
    expect(notificationsHref("announcements")).toBe("/notifications?tab=announcements");
  });
});
