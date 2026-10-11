"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Drawer } from "@/components/overlays/drawer";
import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { ROUTES } from "@/constants/routes";
import { cn } from "@/lib/utils/cn";
import { useSession } from "@/providers/session-provider";
import { Logo } from "./logo";
import { LogOutDialog } from "./log-out-dialog";
import {
  ADMIN_NAV,
  type AdminNavCounts,
  countedAdminSection,
  isNavLinkActive,
  nextClearedAdminCounts,
  shownAdminCounts,
} from "./nav-config";
import { NavCount } from "./nav-count";

type Props = {
  /** Counts beside the links (Verification, Reports, Requests & Meets…), as the admin layout loaded them. */
  counts?: AdminNavCounts;
};

// Admin navigation (ui-guidelines §1). Desktop: a left sidebar with the links, and at its foot the signed-in admin
// and Log out, each on the links' own grid so everything lines up on one edge. Phones and tablets: a top bar with
// the current section and a menu button that opens the same list and foot in a drawer, so the tables below get the
// screen.
//
// A count is news: what arrived in a section since this admin last opened it. It is gone the moment the section is
// opened, here and now, without waiting for the layout to load its counts again (`nextClearedAdminCounts`).
export function AdminSidebar({ counts: loadedCounts = {} }: Props) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const current = ADMIN_NAV.find((item) => isNavLinkActive(pathname, item));

  const [cleared, setCleared] = useState<AdminNavCounts>({});
  const nowCleared = nextClearedAdminCounts(cleared, loadedCounts, countedAdminSection(pathname));
  if (nowCleared !== cleared) setCleared(nowCleared);
  const counts = shownAdminCounts(loadedCounts, nowCleared);
  const waiting = Object.values(counts).reduce((sum, count) => sum + Math.max(count ?? 0, 0), 0);

  return (
    <>
      <header className="sticky top-0 z-(--pf-z-sticky) flex h-16 items-center gap-3 border-b border-line bg-surface px-gutter lg:hidden">
        <Logo href={ROUTES.adminHome} suffix="Admin" wordmark="responsive" />
        <span className="min-w-0 flex-1 truncate font-bold">{current?.label ?? "Admin"}</span>
        {/* The total queue count stays visible while the list is closed, so waiting work isn't hidden. */}
        <span className="relative">
          <IconButton
            icon="menu"
            label={waiting > 0 ? `Open admin menu, ${waiting} waiting` : "Open admin menu"}
            aria-haspopup="dialog"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
          />
          {/* Drawn only: the button's name already says how many are waiting. */}
          <span aria-hidden="true" className="pointer-events-none absolute top-0.5 right-0">
            <NavCount count={waiting} noun="waiting" className="block ring-2 ring-surface" />
          </span>
        </span>
      </header>
      <Drawer open={menuOpen} onClose={() => setMenuOpen(false)} title="Admin menu">
        <nav aria-label="Admin">
          <AdminNavList pathname={pathname} counts={counts} onNavigate={() => setMenuOpen(false)} />
        </nav>
        <AdminAccount className="mt-3 border-t border-line pt-3" />
      </Drawer>

      <aside className="hidden border-r border-line bg-surface lg:sticky lg:top-0 lg:flex lg:h-dvh lg:w-sidebar lg:shrink-0 lg:flex-col">
        <div className="px-4 pt-4 pb-2">
          <Logo href={ROUTES.adminHome} suffix="Admin" />
        </div>
        <nav aria-label="Admin" className="flex-1 overflow-y-auto px-3 pt-1 pb-3">
          <AdminNavList pathname={pathname} counts={counts} />
        </nav>
        <AdminAccount className="border-t border-line px-3 py-3" />
      </aside>
    </>
  );
}

type ListProps = {
  pathname: string;
  counts: AdminNavCounts;
  /** Closes the drawer when a link is chosen, including the page already open. */
  onNavigate?: () => void;
};

function AdminNavList({ pathname, counts, onNavigate }: ListProps) {
  return (
    <ul className="flex flex-col gap-1">
      {ADMIN_NAV.map((item) => {
        const active = isNavLinkActive(pathname, item);
        return (
          <li key={item.id}>
            <Link
              href={item.href}
              onClick={onNavigate}
              // "page" on the page itself, "true" on a page inside its section (a report under Reports).
              aria-current={active ? (pathname === item.href ? "page" : "true") : undefined}
              className={cn(
                "flex min-h-11 items-center justify-between gap-2 rounded-control px-3 no-underline",
                "transition-colors duration-200 ease-out",
                active ? "bg-primary-soft text-primary-soft-ink" : "text-ink-muted hover:bg-surface-sunken hover:text-ink",
              )}
            >
              <span className="whitespace-nowrap">{item.label}</span>
              <NavCount count={counts[item.id]} noun="waiting" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

// The foot of the sidebar: who is signed in, then Log out. Both sit on the links' grid (the same side padding, the
// same row height), so the avatar, the icon and the words line up with the links above, and Log out is a row like
// them: as wide as the sidebar, 44 px tall, named in words. It opens the confirmation every Log out opens.
function AdminAccount({ className }: { className?: string }) {
  const { account } = useSession();
  const [confirming, setConfirming] = useState(false);
  const name = account?.display_name ?? "Admin";

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="flex min-w-0 items-center gap-3 px-3 py-2">
        <Avatar name={name} src={account?.avatar_url ?? undefined} alt="" size="sm" />
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-bold">{name}</span>
          <span className="text-xs text-ink-muted">Platform admin</span>
        </div>
      </div>
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => setConfirming(true)}
        className={cn(
          "flex min-h-11 w-full items-center gap-3 rounded-control px-3 text-left text-ink-muted",
          "transition-colors duration-200 ease-out hover:bg-surface-sunken hover:text-ink",
        )}
      >
        {/* As wide as the avatar above, so "Log out" starts where the admin's name does. */}
        <span className="grid size-8 shrink-0 place-items-center">
          <Icon name="log-out" className="size-5" />
        </span>
        Log out
      </button>
      <LogOutDialog open={confirming} onClose={() => setConfirming(false)} />
    </div>
  );
}
