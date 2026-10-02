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
    // Pet résumés and Home Profiles are opened from Browse, Matches and Search; Browse is the closest home for them.
    {
      id: "browse",
      href: ROUTES.browse,
      label: "Browse",
      shortLabel: "Browse",
      icon: "compass",
      matches: [ROUTES.search, "/pets", "/homes"],
    },
    { id: "requests", href: ROUTES.requests, label: "Requests", shortLabel: "Requests", icon: "briefcase", matches: ["/apply"] },
    // Placeholder for the NT-01 dropdown: a link to the full list until that task replaces it.
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
      profileLink: { href: ROUTES.me, label: "View my résumé" },
      sections: [
        {
          label: "Résumé",
          links: [
            { href: ROUTES.resumeEdit, label: "Edit résumé" },
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

/** Queue sizes next to admin sidebar items (Verification 4, Reports 3…). */
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
export const GUEST_NAV: readonly NavLink[] = [
  { href: `/#${LANDING_SECTIONS.howItWorks}`, label: "How it works" },
  { href: `/#${LANDING_SECTIONS.successStories}`, label: "Success stories" },
  { href: `/#${LANDING_SECTIONS.faq}`, label: "FAQ" },
];

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
