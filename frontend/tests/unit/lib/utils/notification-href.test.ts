import { describe, expect, it } from "vitest";
import { notificationHref } from "@/lib/utils/notification-href";

describe("notificationHref (SEC-FE-07)", () => {
  it("follows the links the API writes: a request, the invites, a post, the account's own pages", () => {
    for (const path of ["/requests/12", "/invites", "/posts/7", "/me", "/settings", "/feed", "/requests"]) {
      expect(notificationHref(path)).toBe(path);
    }
    expect(notificationHref("/requests/12?tab=closed#history")).toBe("/requests/12?tab=closed#history");
  });

  it("never leaves the site, whatever the API stored", () => {
    const elsewhere = ["https://evil.example/requests/1", "//evil.example", "/\\evil.example", "javascript:alert(1)", "http://localhost:3000/requests/1", "requests/1", "/requests/1\n//evil.example"];
    for (const url of elsewhere) expect(notificationHref(url)).toBeNull();
  });

  it("opens only pages a member has", () => {
    for (const path of ["/admin/accounts/5", "/sign-in", "/account/edit", "/", "/api/v1/auth/sign-out", "/post/7"]) {
      expect(notificationHref(path)).toBeNull();
    }
    // A path that only looks like a member page once the browser has resolved it.
    expect(notificationHref("/requests/../admin")).toBeNull();
  });

  it("is no link when there is none, or when it leads back to the list itself", () => {
    expect(notificationHref(null)).toBeNull();
    expect(notificationHref(undefined)).toBeNull();
    expect(notificationHref("")).toBeNull();
    expect(notificationHref("/notifications")).toBeNull();
    expect(notificationHref("/notifications?tab=account")).toBeNull();
  });
});
