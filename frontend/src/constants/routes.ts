// Route paths shared by the proxy, the session provider, navigation and screens. Full route list:
// frontend-guidelines.md §3.

export const ROUTES = {
  landing: "/",
  signIn: "/sign-in",
  forgotPassword: "/forgot-password",
  resetPassword: "/reset-password",
  signUp: "/sign-up",
  signUpPet: "/sign-up/pet",
  signUpHuman: "/sign-up/human",
  accountStatus: "/account-status",
  accountEdit: "/account/edit",
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

/** A pet's public resume (DS-05; DS-08 once the pet is Hired). */
export function petPath(petId: number): string {
  return `/pets/${petId}`;
}

/** A human's Home Profile (DS-07). */
export function homeProfilePath(homeProfileId: number): string {
  return `/homes/${homeProfileId}`;
}

/** The Send request form for a home (RQ-03). */
export function applyPath(homeProfileId: number): string {
  return `/apply/${homeProfileId}`;
}

/** One adoption request, as either side sees it (RQ-11, MG-03…). */
export function requestPath(requestId: number): string {
  return `${ROUTES.requests}/${requestId}`;
}

/** One post on its own page (FD-05). */
export function postPath(postId: number): string {
  return `/posts/${postId}`;
}

/** The feed's query parameter that opens a form on arrival, and its one value: the adoption story form (FD-04). */
export const FEED_COMPOSE_PARAM = "compose";
export const FEED_COMPOSE_STORY = "story";

/** The feed with the adoption story form open: where "Write an adoption story" leads from a profile or an adoption (FD-04). */
export const ADOPTION_STORY_PATH = `/feed?${FEED_COMPOSE_PARAM}=${FEED_COMPOSE_STORY}`;

/** The edit resume wizard opened on a step, 1 to 6 as the screen counts them (PR-03…PR-08). */
export function resumeEditPath(step: number): string {
  return `${ROUTES.resumeEdit}?step=${step}`;
}

/** The Home Profile & quiz wizard opened on a step, 1 to 6 as the screen counts them (PR-14…PR-19). */
export function homeProfileEditPath(step: number): string {
  return `${ROUTES.homeProfileEdit}?step=${step}`;
}

/** One account's review page, opened from the verification queue (AU-23, AU-24). */
export function adminVerificationReviewPath(accountId: number): string {
  return `${ROUTES.adminVerification}/${accountId}`;
}

/** One reported item's review page, opened from the reports queue (RP-04). */
export function adminReportPath(reportId: number): string {
  return `${ROUTES.adminReports}/${reportId}`;
}

/** One account as an admin sees it (AC-07). */
export function adminAccountPath(accountId: number): string {
  return `${ROUTES.adminAccounts}/${accountId}`;
}

/** One adoption request as an admin monitors it (RQ-19). */
export function adminRequestPath(requestId: number): string {
  return `${ROUTES.adminRequests}/${requestId}`;
}

/** The query parameters that open Resolve adoption issue on a pet, and on one of its requests (AL-07). */
export const RESOLVE_PET_PARAM = "pet";
export const RESOLVE_REQUEST_PARAM = "request";

/** Resolve adoption issue opened on a pet, with one of its requests chosen when the issue is about that one (AL-07). */
export function adminResolvePath(petId: number, requestId?: number): string {
  const query = new URLSearchParams({ [RESOLVE_PET_PARAM]: String(petId), ...(requestId !== undefined && { [RESOLVE_REQUEST_PARAM]: String(requestId) }) });
  return `${ROUTES.adminResolve}?${query}`;
}

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
export const ACCOUNT_STATUS_ROUTE_PREFIXES = [ROUTES.accountStatus, ROUTES.accountEdit] as const;

export const ADMIN_ROUTE_PREFIX = "/admin";

/** Where the sign-in page sends the user back to after signing in. */
export const NEXT_PATH_PARAM = "next";
