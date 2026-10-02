"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { ROUTES } from "@/constants/routes";
import { cn } from "@/lib/utils/cn";
import { useSession } from "@/providers/session-provider";
import { Logo } from "./logo";
import { ADMIN_NAV, type AdminNavCounts, isNavLinkActive } from "./nav-config";
import { NavCount } from "./nav-count";
import { SignOutButton } from "./sign-out-button";

type Props = {
  /** Queue sizes (Verification, Reports, Requests & Meets…). Filled in by the admin screen tasks. */
  counts?: AdminNavCounts;
};

// Admin navigation (ui-guidelines §1). Desktop: a left sidebar with the signed-in admin and Log out at the bottom.
// Phone: a wrapped tab strip above the page, as in the mobile LoFi; Log out stays in reach next to the mark.
export function AdminSidebar({ counts = {} }: Props) {
  const pathname = usePathname();
  const { account } = useSession();
  const name = account?.display_name ?? "Admin";

  return (
    <aside className="border-b border-line bg-surface lg:sticky lg:top-0 lg:flex lg:h-dvh lg:w-sidebar lg:shrink-0 lg:flex-col lg:border-r lg:border-b-0">
      <div className="flex items-center justify-between gap-3 px-gutter pt-2 lg:px-4 lg:pt-4 lg:pb-2">
        <Logo href={ROUTES.adminHome} suffix="Admin" wordmark="responsive" />
        <SignOutButton variant="tertiary" className="lg:hidden" />
      </div>

      <nav aria-label="Admin" className="px-gutter pt-1 pb-3 lg:flex-1 lg:overflow-y-auto lg:px-3">
        <ul className="flex flex-wrap gap-1 lg:flex-col">
          {ADMIN_NAV.map((item) => {
            const active = isNavLinkActive(pathname, item);
            return (
              <li key={item.id}>
                <Link
                  href={item.href}
                  // "page" on the page itself, "true" on a page inside its section (a report under Reports).
                  aria-current={active ? (pathname === item.href ? "page" : "true") : undefined}
                  className={cn(
                    "flex min-h-11 items-center justify-between gap-2 rounded-control px-3 no-underline",
                    "transition-colors duration-200 ease-out",
                    // No bold on the active item: a wider label would reflow the wrapped strip on phones.
                    active
                      ? "bg-primary-soft text-primary-soft-ink"
                      : "text-ink-muted hover:bg-surface-sunken hover:text-ink",
                  )}
                >
                  <span className="whitespace-nowrap">{item.label}</span>
                  <NavCount count={counts[item.id]} noun="waiting" />
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="hidden flex-col items-start gap-2 border-t border-line px-4 py-3 lg:flex">
        <div className="flex w-full min-w-0 items-center gap-3">
          <Avatar name={name} src={account?.avatar_url ?? undefined} alt="" size="sm" />
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-bold">{name}</span>
            <span className="text-xs text-ink-muted">Platform admin</span>
          </div>
        </div>
        {/* Pulled left by its own padding, so "Log out" lines up with the avatar. */}
        <SignOutButton variant="tertiary" className="-ml-4" />
      </div>
    </aside>
  );
}
