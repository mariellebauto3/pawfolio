// Route paths shared by the proxy, the session provider and screens. Full route list: frontend-guidelines.md §3.

export const ROUTES = {
  landing: "/",
  signIn: "/sign-in",
  accountStatus: "/account-status",
  memberHome: "/feed",
  adminHome: "/admin",
} as const;

/** Pet & Human pages behind login: the `(member)` route group. */
export const MEMBER_ROUTE_PREFIXES = [
  "/feed",
  "/posts",
  "/matches",
  "/browse",
  "/search",
  "/pets",
  "/homes",
  "/me",
  "/resume",
  "/home-profile",
  "/availability",
  "/invites",
  "/apply",
  "/requests",
  "/notifications",
  "/bookmarks",
  "/stats",
  "/activity",
  "/settings",
] as const;

/** The only pages a Pending, Denied or Suspended account may open (AU-18…AU-21). */
export const ACCOUNT_STATUS_ROUTE_PREFIXES = ["/account-status", "/account/edit"] as const;

export const ADMIN_ROUTE_PREFIX = "/admin";

/** Where the sign-in page sends the user back to after signing in. */
export const NEXT_PATH_PARAM = "next";
