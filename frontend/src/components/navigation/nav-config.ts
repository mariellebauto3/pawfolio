import type { IconName } from "@/components/ui/icon";
import { LANDING_SECTIONS, ROUTES } from "@/constants/routes";
import type { Role } from "@/types/statuses";

// What each shell links to, per role (LoFi GN-01, sitemap on page 4 of the LoFi PDF). Showing a link is never the
// access check: the API refuses what a role may not do (SEC-FE-05).

export type NavLink = {
  href: string;
  label: string;
  /** Other paths that belong to this item, so it stays highlighted on its detail pages. */
  matches?: readonly string[];
  /** Highlight only on `href` itself, not on paths below it (the admin Dashboard at /admin). */
  exact?: boolean;
};

export type MemberNavId = "home" | "matches" | "browse" | "requests" | "alerts";

export type MemberNavItem = NavLink & {
  id: MemberNavId;
  /** The shorter label on phones, where six tabs share one row ("Matches" for "Homes for You"). */
  shortLabel: string;
  icon: IconName;
};

/** Unread counts shown on top-bar tabs: Requests and Alerts (GN-01). */
export type MemberNavCounts = Partial<Record<"requests" | "alerts", number>>;

/** The member top bar without Me. Pets see "Homes for You", humans "Pets for You"; other roles see neither. */
export function memberNavItems(role: Role | null): MemberNavItem[] {
  const matches: MemberNavItem[] =
    role === "pet" || role === "human"
      ? [
          {
            id: "matches",
            href: ROUTES.matches,
            label: role === "pet" ? "Homes for You" : "Pets for You",
            shortLabel: "Matches",
            icon: "heart",
          },
        ]
      : [];

  return [
    { id: "home", href: ROUTES.memberHome, label: "Home", shortLabel: "Home", icon: "home", matches: ["/posts"] },
    ...matches,
    // Pet resumes and Home Profiles are opened from Browse, Matches and Search; Browse is the closest home for them.
    {
      id: "browse",
      href: ROUTES.browse,
      label: "Browse",
      shortLabel: "Browse",
      icon: "compass",
      matches: [ROUTES.search, "/pets", "/homes"],
    },
    { id: "requests", href: ROUTES.requests, label: "Requests", shortLabel: "Requests", icon: "briefcase", matches: ["/apply"] },
    // The desktop top bar opens the NT-01 dropdown here instead (`AlertsMenu`); the phone tab bar links to the list.
    { id: "alerts", href: ROUTES.notifications, label: "Alerts", shortLabel: "Alerts", icon: "bell" },
  ];
}

export type MeMenuSection = { label: string; links: NavLink[] };

/** The Me menu (GN-01) below the profile card. Log out is added by the menu itself. */
export function meMenuFor(role: Role | null): { profileLink: NavLink | null; sections: MeMenuSection[] } {
  const account: MeMenuSection = {
    label: "Account",
    links: [
      { href: ROUTES.activity, label: "My activity" },
      { href: ROUTES.settings, label: "Settings" },
    ],
  };

  if (role === "pet") {
    return {
      profileLink: { href: ROUTES.me, label: "View my resume" },
      sections: [
        {
          label: "Resume",
          links: [
            { href: ROUTES.resumeEdit, label: "Edit resume" },
            { href: ROUTES.invites, label: "Invites to Apply" },
            { href: ROUTES.bookmarks, label: "Bookmarks" },
            { href: ROUTES.stats, label: "My stats" },
          ],
        },
        account,
      ],
    };
  }

  if (role === "human") {
    return {
      profileLink: { href: ROUTES.me, label: "View my Home Profile" },
      sections: [
        {
          label: "Home Profile",
          links: [
            { href: ROUTES.homeProfileEdit, label: "Edit Home Profile & quiz" },
            { href: ROUTES.availability, label: "Meet & Greet availability" },
            { href: ROUTES.bookmarks, label: "Bookmarks" },
            { href: ROUTES.stats, label: "Match & request history" },
          ],
        },
        account,
      ],
    };
  }

  // Admins have no member profile; they only need the way back to their own pages.
  if (role === "admin") {
    return { profileLink: null, sections: [{ label: "Admin", links: [{ href: ROUTES.adminHome, label: "Admin dashboard" }] }] };
  }

  return { profileLink: null, sections: [] };
}

export type AdminNavId =
  | "dashboard"
  | "verification"
  | "reports"
  | "requests"
  | "resolve"
  | "accounts"
  | "announcements"
  | "activity-logs";

export type AdminNavItem = NavLink & { id: AdminNavId };

/**
 * The sections whose sidebar item carries a count. A count is news: what arrived in the section since this admin
 * last opened it. Opening the section clears it (the API is told, `POST /admin/sidebar/{section}/seen`), and it
 * comes back only when something new arrives. How long each queue is stays on the dashboard and on its own page.
 */
export const ADMIN_COUNTED_SECTIONS = ["verification", "reports", "requests"] as const satisfies readonly AdminNavId[];
export type AdminCountedSection = (typeof ADMIN_COUNTED_SECTIONS)[number];

/** Counts next to admin sidebar items (Verification 4, Reports 3…). */
export type AdminNavCounts = Partial<Record<AdminNavId, number>>;

export const ADMIN_NAV: readonly AdminNavItem[] = [
  { id: "dashboard", href: ROUTES.adminHome, label: "Dashboard", exact: true },
  { id: "verification", href: ROUTES.adminVerification, label: "Verification" },
  { id: "reports", href: ROUTES.adminReports, label: "Reports" },
  { id: "requests", href: ROUTES.adminRequests, label: "Requests & Meets" },
  { id: "resolve", href: ROUTES.adminResolve, label: "Resolve Issues" },
  { id: "accounts", href: ROUTES.adminAccounts, label: "Accounts & Alumni" },
  { id: "announcements", href: ROUTES.adminAnnouncements, label: "Announcements" },
  { id: "activity-logs", href: ROUTES.adminActivityLogs, label: "Activity Logs" },
];

/** Guest top bar links: sections of the landing page (AU-01). */
/** Visitor nav. Home comes first (added 2026-10-03 for visitors who don't know the logo is a link); render it with
 * HomeLink so it scrolls back to the hero when the landing page is already open. */
export const GUEST_NAV: readonly NavLink[] = [
  { href: ROUTES.landing, label: "Home" },
  { href: `/#${LANDING_SECTIONS.howItWorks}`, label: "How it works" },
  { href: `/#${LANDING_SECTIONS.successStories}`, label: "Success stories" },
  { href: `/#${LANDING_SECTIONS.faq}`, label: "FAQ" },
];

/** The counted section `pathname` is inside (its own page or one below it), or null. */
export function countedAdminSection(pathname: string): AdminCountedSection | null {
  const open = ADMIN_NAV.find((item) => isNavLinkActive(pathname, item))?.id;
  return ADMIN_COUNTED_SECTIONS.find((section) => section === open) ?? null;
}

/**
 * What the sidebar remembers having cleared, as it goes from one render to the next. `counts` are the layout's,
 * which are loaded again only now and then, so on their own they would bring a number back after the admin has
 * looked. The count of the open section is remembered as seen; a remembered one is forgotten once the layout's
 * count is a different number, because that is a new answer from the API, not the old one. Returns `cleared`
 * itself when nothing changes, so it can be compared by identity.
 */
export function nextClearedAdminCounts(cleared: AdminNavCounts, counts: AdminNavCounts, open: AdminCountedSection | null): AdminNavCounts {
  const next: AdminNavCounts = {};
  for (const section of ADMIN_COUNTED_SECTIONS) {
    const count = counts[section];
    if (count === undefined) continue;
    if (section === open || cleared[section] === count) next[section] = count;
  }
  const same = ADMIN_COUNTED_SECTIONS.every((section) => next[section] === cleared[section]);
  return same ? cleared : next;
}

/** The counts the sidebar shows: the layout's, without the ones the admin has already looked at. */
export function shownAdminCounts(counts: AdminNavCounts, cleared: AdminNavCounts): AdminNavCounts {
  const shown = { ...counts };
  for (const section of ADMIN_COUNTED_SECTIONS) {
    if (cleared[section] !== undefined && cleared[section] === counts[section]) delete shown[section];
  }
  return shown;
}

/** Whether `pathname` is inside a nav item's section: its own path, a page below it, or one of its `matches`. */
export function isNavLinkActive(pathname: string, link: NavLink): boolean {
  if (link.exact) return pathname === link.href;
  return [link.href, ...(link.matches ?? [])].some((base) => pathname === base || pathname.startsWith(`${base}/`));
}

/** A count as a badge shows it: nothing for 0 or less, "99+" above 99. */
export function formatNavCount(count: number | undefined): string | null {
  if (!count || count <= 0) return null;
  return count > 99 ? "99+" : String(Math.floor(count));
}
