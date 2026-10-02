"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment } from "react";
import { Skeleton } from "@/components/feedback/skeleton";
import { Icon } from "@/components/ui/icon";
import { ROUTES } from "@/constants/routes";
import { cn } from "@/lib/utils/cn";
import { useSession } from "@/providers/session-provider";
import { Logo } from "./logo";
import { MeMenu } from "./me-menu";
import { MemberSearch } from "./member-search";
import { type MemberNavCounts, isNavLinkActive, meMenuFor, memberNavItems } from "./nav-config";
import { NavCount } from "./nav-count";

// Icon over label, like the LoFi. The 3 px underline marks the current section, as in Tabs.
const TAB_CLASSES =
  "relative flex h-full min-w-11 flex-col items-center justify-center gap-0.5 border-y-[3px] border-transparent " +
  "text-xs text-ink-muted no-underline transition-colors duration-200 ease-out hover:text-ink " +
  "sm:px-1 lg:min-w-16 lg:px-2 lg:text-sm";
const ACTIVE_TAB_CLASSES = "border-b-primary text-ink";

type Props = {
  /** Unread counts for Requests and Alerts. Filled in by the requests and notifications tasks (RQ, NT-01). */
  counts?: MemberNavCounts;
};

// GN-01. Desktop: one row (logo, search, tabs). Phone: icon tabs with short labels next to the logo mark, search on
// its own row below (ui-guidelines §1).
export function MemberTopBar({ counts = {} }: Props) {
  const pathname = usePathname();
  const { account, role, status } = useSession();
  const items = memberNavItems(role);
  const { profileLink, sections } = meMenuFor(role);
  const meLinks = [...(profileLink ? [profileLink] : []), ...sections.flatMap((section) => section.links)];
  const meActive = meLinks.some((link) => isNavLinkActive(pathname, link));

  return (
    <header className="sticky top-0 z-(--pf-z-sticky) border-b border-line bg-surface">
      <div className="mx-auto flex max-w-content flex-wrap items-center gap-x-3 px-gutter lg:flex-nowrap lg:gap-x-4">
        {/* Six 44 px tabs and the mark don't fit below 375 px; the Home tab goes to the same place. */}
        <Logo href={ROUTES.memberHome} wordmark="responsive" className="max-[23.4375rem]:hidden" />

        <MemberSearch role={role} className="order-last basis-full pb-2 lg:order-0 lg:w-72 lg:basis-auto lg:pb-0" />

        <nav aria-label="Main" className="flex h-14 min-w-0 flex-1 justify-end lg:ml-auto lg:h-16 lg:flex-none">
          <ul className="flex h-full w-full items-stretch justify-between sm:w-auto sm:justify-end sm:gap-1">
            {items.map((item, i) => {
              const active = isNavLinkActive(pathname, item);
              const count = item.id === "requests" || item.id === "alerts" ? counts[item.id] : undefined;
              return (
                <Fragment key={item.id}>
                  {/* Holds the place of the role's own tab while the account loads, so the row doesn't jump. */}
                  {i === 1 && status === "loading" && (
                    <li aria-hidden="true" className={TAB_CLASSES}>
                      <Skeleton shape="circle" className="size-6" />
                      <Skeleton className="h-3 w-12" />
                    </li>
                  )}
                  <li className="flex">
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(TAB_CLASSES, active && ACTIVE_TAB_CLASSES)}
                  >
                    <Icon name={item.icon} className="size-6" />
                    {item.shortLabel === item.label ? (
                      <span>{item.label}</span>
                    ) : (
                      <>
                        <span className="lg:hidden">{item.shortLabel}</span>
                        <span className="hidden whitespace-nowrap lg:inline">{item.label}</span>
                      </>
                    )}
                    <NavCount
                      count={count}
                      noun={item.id === "alerts" ? "unread" : "new"}
                      // The ring keeps a wide count ("99+") readable where it overlaps the next tab.
                      className="absolute top-1 left-1/2 ml-0.5 ring-2 ring-surface lg:top-1.5"
                    />
                  </Link>
                  </li>
                </Fragment>
              );
            })}
            <li className="flex">
              <MeMenu account={account} triggerClassName={cn(TAB_CLASSES, meActive && ACTIVE_TAB_CLASSES)} />
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
