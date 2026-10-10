import { describe, expect, it } from "vitest";
import { normalizeApiError } from "@/lib/api/errors";
import {
  afterSignInPath,
  errorRedirect,
  homePathFor,
  routeArea,
  routeRedirect,
  safeNextPath,
  signInPath,
} from "@/lib/auth/redirects";
import type { Account } from "@/types/account";

function account(overrides: Partial<Account> = {}): Account {
  return {
    id: 1,
    role: "pet",
    status: "active",
    email: "mochi@example.com",
    display_name: "Mochi",
    avatar_url: null,
    profile_id: 1,
    ...overrides,
  };
}

describe("routeArea", () => {
  it.each([
    ["/", "public"],
    ["/sign-in", "public"],
    ["/sign-up/pet", "public"],
    ["/ui-kit", "public"],
    ["/feed", "member"],
    ["/requests/12", "member"],
    ["/pets/3", "member"],
    ["/admin", "admin"],
    ["/admin/verification/4", "admin"],
    ["/account-status", "account-status"],
    ["/account/edit", "account-status"],
    // Matches whole segments only.
    ["/feedback", "public"],
    ["/administrator", "public"],
  ])("%s is %s", (path, area) => {
    expect(routeArea(path)).toBe(area);
  });
});

describe("routeRedirect", () => {
  it("lets anyone open public pages", () => {
    expect(routeRedirect("/", null)).toBeNull();
    expect(routeRedirect("/sign-in", account({ status: "suspended" }))).toBeNull();
  });

  it("sends signed-out visitors to sign-in and back again", () => {
    expect(routeRedirect("/requests/12?tab=thread", null)).toBe("/sign-in?next=%2Frequests%2F12%3Ftab%3Dthread");
    expect(routeRedirect("/admin", null)).toBe("/sign-in?next=%2Fadmin");
    expect(routeRedirect("/account-status", null)).toBe("/sign-in?next=%2Faccount-status");
  });

  it.each(["pending_verification", "denied", "suspended", "deactivated"] as const)(
    "sends %s accounts to the account-status screen",
    (status) => {
      expect(routeRedirect("/feed", account({ status }))).toBe("/account-status");
      expect(routeRedirect("/admin", account({ role: "admin", status }))).toBe("/account-status");
      expect(routeRedirect("/account-status", account({ status }))).toBeNull();
      expect(routeRedirect("/account/edit", account({ status }))).toBeNull();
    },
  );

  it("sends pets and humans away from admin URLs to their own dashboard", () => {
    expect(routeRedirect("/admin/reports", account({ role: "pet" }))).toBe("/feed");
    expect(routeRedirect("/admin/activity-logs", account({ role: "pet" }))).toBe("/feed");
    expect(routeRedirect("/admin", account({ role: "human" }))).toBe("/feed");
    // Legacy denial URLs also redirect without revealing the restricted module.
    expect(routeRedirect("/admins-only", account({ role: "pet" }))).toBe("/feed");
    expect(routeRedirect("/admin/activity-logs", null)).toBe("/sign-in?next=%2Fadmin%2Factivity-logs");
    expect(routeRedirect("/admin/reports", account({ role: "admin" }))).toBeNull();
  });

  it.each(["pet", "human", "admin"] as const)("redirects a signed-in %s from landing", (role) => {
    const user = account({ role });
    expect(routeRedirect("/?campaign=welcome", user)).toBe(homePathFor(user));
  });

  it.each([
    ["/feed", "admin", "/admin"],
    ["/resume/edit?step=2", "human", "/feed"],
    ["/invites", "human", "/feed"],
    ["/apply/12", "human", "/feed"],
    ["/home-profile/edit", "pet", "/feed"],
    ["/availability", "pet", "/feed"],
    ["/admin/reports/private.json", "human", "/feed"],
  ] as const)("redirects %s for %s without a denial page", (path, role, home) => {
    expect(routeRedirect(path, account({ role }))).toBe(home);
  });

  it("lets Active members through", () => {
    expect(routeRedirect("/feed", account())).toBeNull();
    expect(routeRedirect("/matches", account({ role: "human" }))).toBeNull();
  });
});

describe("errorRedirect", () => {
  it("sends a 401 on a signed-in page to sign-in", () => {
    expect(errorRedirect(normalizeApiError(401, null), "/requests/2")).toBe("/sign-in?next=%2Frequests%2F2");
  });

  it("does not redirect a 401 on a public page", () => {
    expect(errorRedirect(normalizeApiError(401, null), "/sign-in")).toBeNull();
  });

  it("sends account_not_active to the account-status screen once", () => {
    const error = normalizeApiError(403, { code: "account_not_active" });
    expect(errorRedirect(error, "/feed")).toBe("/account-status");
    expect(errorRedirect(error, "/account/edit")).toBeNull();
  });

  it("leaves other errors to the screen", () => {
    expect(errorRedirect(normalizeApiError(403, null), "/admin")).toBeNull();
    expect(errorRedirect(normalizeApiError(409, null), "/requests")).toBeNull();
    expect(errorRedirect(normalizeApiError(422, null), "/requests")).toBeNull();
  });
});

describe("homePathFor", () => {
  it("picks the right home", () => {
    expect(homePathFor(account())).toBe("/feed");
    expect(homePathFor(account({ role: "admin" }))).toBe("/admin");
    expect(homePathFor(account({ status: "pending_verification" }))).toBe("/account-status");
  });
});

describe("safeNextPath", () => {
  it.each(["/feed", "/requests/12?tab=thread", "/pets/3#photos"])("accepts %s", (path) => {
    expect(safeNextPath(path)).toBe(path);
  });

  it.each([
    null,
    undefined,
    "",
    "feed",
    "https://evil.example/feed",
    "//evil.example/feed",
    "/\\evil.example",
    "/\tevil",
    "/feed\\..\\x",
    "javascript:alert(1)",
  ])("rejects %s", (path) => {
    expect(safeNextPath(path)).toBeNull();
  });

  it("normalizes dot segments", () => {
    expect(safeNextPath("/feed/../admin")).toBe("/admin");
  });
});

describe("signInPath", () => {
  it("drops unsafe or pointless next values", () => {
    expect(signInPath()).toBe("/sign-in");
    expect(signInPath("//evil.example")).toBe("/sign-in");
    expect(signInPath("/")).toBe("/sign-in");
    expect(signInPath("/sign-in")).toBe("/sign-in");
  });
});

describe("afterSignInPath (AU-02)", () => {
  it("sends each account to its home when there is no next page", () => {
    expect(afterSignInPath(account(), null)).toBe("/feed");
    expect(afterSignInPath(account({ role: "admin", profile_id: null }), null)).toBe("/admin");
    expect(afterSignInPath(account({ status: "pending_verification" }), null)).toBe("/account-status");
    expect(afterSignInPath(account({ status: "suspended" }), "/feed")).toBe("/account-status");
  });

  it("always opens the dashboard even with an allowed next page", () => {
    expect(afterSignInPath(account(), "/requests/12?tab=thread")).toBe("/feed");
    expect(afterSignInPath(account({ role: "admin", profile_id: null }), "/admin/reports")).toBe("/admin");
  });

  it("ignores next pages the account may not open, public pages and other sites (SEC-FE-07)", () => {
    // A requested module never overrides the dashboard destination.
    expect(afterSignInPath(account(), "/admin/reports")).toBe("/feed");
    expect(afterSignInPath(account({ status: "suspended" }), "/admin/reports")).toBe("/account-status");
    expect(afterSignInPath(account(), "/sign-in")).toBe("/feed");
    expect(afterSignInPath(account(), "https://evil.example/feed")).toBe("/feed");
    expect(afterSignInPath(account(), "//evil.example")).toBe("/feed");
  });
});
