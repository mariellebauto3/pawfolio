"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Skeleton } from "@/components/feedback/skeleton";
import { Icon } from "@/components/ui/icon";
import { ROUTES } from "@/constants/routes";
import { cn } from "@/lib/utils/cn";
import { useSession } from "@/providers/session-provider";
import { Logo } from "./logo";
import { MeMenu } from "./me-menu";
import { MemberSearch } from "./member-search";
import { type MemberNavCounts, type MemberNavItem, isNavLinkActive, meMenuFor, memberNavItems } from "./nav-config";
import { NavCount } from "./nav-count";

type Placement = "top" | "bottom";

// Icon over label. A 3 px bar marks the current section, as in Tabs: under the tab in the top bar, over it in the
// bottom bar.
const TAB_CLASSES: Record<Placement, string> = {
  top:
    "relative flex h-full min-w-16 flex-col items-center justify-center gap-0.5 border-y-[3px] border-transparent " +
    "px-2 text-sm text-ink-muted no-underline transition-colors duration-200 ease-out hover:text-ink",
  bottom:
    "relative flex h-full w-full flex-col items-center justify-center gap-0.5 border-t-[3px] border-transparent " +
    "text-xs text-ink-muted no-underline transition-colors duration-200 ease-out hover:text-ink",
};
const ACTIVE_CLASSES: Record<Placement, string> = {
  top: "border-b-primary text-ink",
  bottom: "border-t-primary text-ink",
};

// The Me trigger: a round avatar button on phones, a tab like the others from lg.
const ME_CLASSES =
  "flex size-11 shrink-0 flex-col items-center justify-center gap-0.5 rounded-pill text-sm text-ink-muted " +
  "transition-colors duration-200 ease-out hover:text-ink aria-expanded:text-ink " +
  "lg:h-16 lg:w-auto lg:min-w-16 lg:rounded-none lg:border-y-[3px] lg:border-transparent lg:px-2";

type Props = {
  /** Unread counts for Requests and Alerts. Filled in by the requests and notifications tasks (RQ, NT-01). */
  counts?: MemberNavCounts;
};

// GN-01. Desktop: one 64 px row with logo, search, tabs and Me. Phones and tablets: logo, search and Me on top, and the
// tabs in a bar fixed to the bottom of the screen, so neither row is crowded and the counts stay in view
// (ui-guidelines §1).
export function MemberTopBar({ counts = {} }: Props) {
  const pathname = usePathname();
  const { account, role, status } = useSession();
  const items = memberNavItems(role);
  const { profileLink, sections } = meMenuFor(role);
  const meLinks = [...(profileLink ? [profileLink] : []), ...sections.flatMap((section) => section.links)];
  const meActive = meLinks.some((link) => isNavLinkActive(pathname, link));

  const tabs = (placement: Placement) => (
    <NavTabs placement={placement} items={items} pathname={pathname} counts={counts} loading={status === "loading"} />
  );

  return (
    <>
      <header className="sticky top-0 z-(--pf-z-sticky) border-b border-line bg-surface">
        <div className="mx-auto flex h-16 max-w-content items-center gap-3 px-gutter lg:gap-4">
          <Logo href={ROUTES.memberHome} wordmark="responsive" />
          <MemberSearch role={role} className="min-w-0 flex-1 lg:w-72 lg:flex-none" />
          <nav aria-label="Main" className="ml-auto hidden h-full lg:block">
            {tabs("top")}
          </nav>
          <MeMenu account={account} triggerClassName={cn(ME_CLASSES, meActive && "lg:border-b-primary lg:text-ink")} />
        </div>
      </header>

      {/* data-bottom-nav lifts toasts and page ends above this bar (globals.css, --pf-bottom-offset). */}
      <nav
        aria-label="Main"
        data-bottom-nav
        className="fixed inset-x-0 bottom-0 z-(--pf-z-sticky) border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        <div className="mx-auto h-(--pf-bottom-nav-h) max-w-content px-1">{tabs("bottom")}</div>
      </nav>
    </>
  );
}

type TabsProps = {
  placement: Placement;
  items: MemberNavItem[];
  pathname: string;
  counts: MemberNavCounts;
  /** The account is still loading: hold the place of the role's own tab so the row doesn't jump. */
  loading: boolean;
};

function NavTabs({ placement, items, pathname, counts, loading }: TabsProps) {
  const entries: Array<MemberNavItem | "placeholder"> = loading ? [items[0], "placeholder", ...items.slice(1)] : items;

  return (
    <ul className={cn("flex h-full", placement === "top" ? "gap-1" : "justify-around")}>
      {entries.map((item) => {
        const itemClasses = cn("flex", placement === "bottom" && "min-w-0 flex-1");
        if (item === "placeholder") {
          return (
            <li key="placeholder" aria-hidden="true" className={itemClasses}>
              <span className={TAB_CLASSES[placement]}>
                <Skeleton shape="circle" className="size-6" />
                <Skeleton className="h-3 w-12" />
              </span>
            </li>
          );
        }

        const active = isNavLinkActive(pathname, item);
        const count = item.id === "requests" || item.id === "alerts" ? counts[item.id] : undefined;
        return (
          <li key={item.id} className={itemClasses}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(TAB_CLASSES[placement], active && ACTIVE_CLASSES[placement])}
            >
              <Icon name={item.icon} className="size-6" />
              <span className="whitespace-nowrap">{placement === "top" ? item.label : item.shortLabel}</span>
              <NavCount
                count={count}
                noun={item.id === "alerts" ? "unread" : "new"}
                // The ring keeps a wide count ("99+") readable where it overlaps the icon's surroundings.
                className="absolute top-1.5 left-1/2 ml-1 ring-2 ring-surface"
              />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
