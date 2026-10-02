// Route paths shared by the proxy, the session provider, navigation and screens. Full route list:
// frontend-guidelines.md §3.

export const ROUTES = {
  landing: "/",
  signIn: "/sign-in",
  signUp: "/sign-up",
  accountStatus: "/account-status",
  memberHome: "/feed",
  adminHome: "/admin",

  // Member (pet and human)
  search: "/search",
  matches: "/matches",
  browse: "/browse",
  requests: "/requests",
  notifications: "/notifications",
  me: "/me",
  resumeEdit: "/resume/edit",
  homeProfileEdit: "/home-profile/edit",
  invites: "/invites",
  availability: "/availability",
  bookmarks: "/bookmarks",
  stats: "/stats",
  activity: "/activity",
  settings: "/settings",

  // Admin
  adminVerification: "/admin/verification",
  adminReports: "/admin/reports",
  adminRequests: "/admin/requests",
  adminResolve: "/admin/resolve",
  adminAccounts: "/admin/accounts",
  adminAnnouncements: "/admin/announcements",
  adminActivityLogs: "/admin/activity-logs",
} as const;

/**
 * Section ids on the landing page (AU-01), linked from the guest top bar and footer. The landing page must give its
 * sections these ids.
 */
export const LANDING_SECTIONS = {
  howItWorks: "how-it-works",
  successStories: "success-stories",
  faq: "faq",
} as const;

/** Help center link in the account-status bar and footer. The FAQ answers the questions it covers until it has a page. */
export const HELP_CENTER_PATH = `/#${LANDING_SECTIONS.faq}`;

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
