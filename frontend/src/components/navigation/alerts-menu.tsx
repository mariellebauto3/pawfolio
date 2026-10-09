"use client";

import Link from "next/link";
import { type FocusEvent, type KeyboardEvent, useEffect, useId, useRef, useState } from "react";
import { NotificationRow } from "@/components/data-display/notification-row";
import { Skeleton, SkeletonGroup } from "@/components/feedback/skeleton";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { ROUTES } from "@/constants/routes";
import { isApiError } from "@/lib/api/errors";
import { cn } from "@/lib/utils/cn";
import { formatTimeAgo } from "@/lib/utils/format-date";
import type { Alerts } from "@/providers/alerts-provider";
import { useToast } from "@/providers/toast-provider";
import { NavCount } from "./nav-count";

type Props = {
  alerts: Alerts;
  /** The top bar's tab styling, including its active state on the Notifications page. */
  triggerClassName: string;
  /** Where the count sits on the tab, as on the tabs beside it. */
  countClassName: string;
};

// NT-01 Alerts dropdown: the latest few notifications from any page, Mark all as read, and the way to the full
// list. A disclosure, not a menu: the panel holds links and a button that Tab reaches in order, right after the
// tab that opens it. Escape closes and returns focus; so does a click, or focus, anywhere else.
export function AlertsMenu({ alerts, triggerClassName, countClassName }: Props) {
  const baseId = useId();
  const panelId = `${baseId}-panel`;
  const headingId = `${baseId}-heading`;
  // When it was last opened: the moment its "2h ago" labels are counted from. Null while it has never been open.
  const [openedAt, setOpenedAt] = useState<Date | null>(null);
  const [open, setOpen] = useState(false);
  const [marking, setMarking] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const toast = useToast();
  const { latest, unreadCount } = alerts;

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: globalThis.PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  function toggle() {
    // Asked for again each time it opens; what was loaded before shows until the answer is in.
    if (!open) {
      alerts.loadLatest();
      setOpenedAt(new Date());
    }
    setOpen(!open);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Escape" || !open) return;
    event.stopPropagation();
    setOpen(false);
    buttonRef.current?.focus();
  }

  // Tab moved on to the rest of the page: the panel doesn't stay open behind it.
  function handleBlur(event: FocusEvent<HTMLDivElement>) {
    if (event.relatedTarget instanceof Node && !event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }

  async function markAllRead() {
    setMarking(true);
    try {
      await alerts.markAllRead();
      toast.show("All notifications marked as read.");
      // The button leaves once nothing is unread; keyboard focus goes back to the tab instead of being dropped.
      buttonRef.current?.focus();
    } catch (error) {
      if (!isApiError(error)) throw error;
      toast.show(error.message, { tone: "error" });
    } finally {
      setMarking(false);
    }
  }

  const hasUnread = marking || latest.items.some((item) => alerts.isUnread(item)) || (unreadCount ?? 0) > 0;

  return (
    <div ref={rootRef} className="relative flex h-full" onKeyDown={handleKeyDown} onBlur={handleBlur}>
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={toggle}
        className={triggerClassName}
      >
        <Icon name="bell" className="size-6" />
        <span className="whitespace-nowrap">Alerts</span>
        <NavCount count={unreadCount} noun="unread" className={countClassName} />
      </button>

      {open && openedAt && (
        <section
          id={panelId}
          aria-labelledby={headingId}
          className={cn(
            "absolute top-full right-0 z-(--pf-z-dropdown) mt-2 flex w-96 max-w-[calc(100vw-2rem)] flex-col",
            "animate-menu-in rounded-card border border-line bg-surface shadow-menu",
          )}
        >
          <div className="flex min-h-14 items-center justify-between gap-3 border-b border-line py-1.5 pr-1.5 pl-4">
            <h2 id={headingId} className="text-lg">
              Notifications
            </h2>
            {hasUnread && (
              <Button variant="tertiary" size="sm" loading={marking} loadingLabel="Marking all as read" onClick={markAllRead}>
                Mark all as read
              </Button>
            )}
          </div>

          {/* Tall enough for four rows of two-line messages; it scrolls only when the window is shorter than that. */}
          <div className="max-h-[min(34rem,calc(100dvh-12rem))] overflow-y-auto p-1.5">
            {latest.items.length > 0 ? (
              <ul className="flex flex-col gap-1">
                {latest.items.map((item) => (
                  <li key={item.id}>
                    <NotificationRow
                      notification={item}
                      when={formatTimeAgo(item.created_at, openedAt)}
                      unread={alerts.isUnread(item)}
                      density="compact"
                      onOpen={() => {
                        if (alerts.isUnread(item)) alerts.markRead(item);
                        setOpen(false);
                      }}
                    />
                  </li>
                ))}
              </ul>
            ) : latest.status === "error" ? (
              <div role="alert" className="flex flex-col items-center gap-2 px-4 py-6 text-center">
                <p className="text-ink-muted">We couldn’t load your notifications.</p>
                <Button variant="tertiary" size="sm" icon={<Icon name="refresh" className="size-4" />} onClick={alerts.loadLatest}>
                  Try again
                </Button>
              </div>
            ) : latest.status === "ready" ? (
              <div className="flex flex-col items-center gap-1 px-4 py-6 text-center">
                <Icon name="bell" className="mb-1 size-6 text-ink-muted" />
                <p className="font-bold">No notifications yet</p>
                <p className="text-sm text-ink-muted">News about your requests, Meet &amp; Greets and account shows up here.</p>
              </div>
            ) : (
              <SkeletonGroup label="Loading notifications" className="flex flex-col gap-1">
                {Array.from({ length: 4 }, (_, i) => (
                  <span key={i} className="flex items-start gap-3 px-2.5 py-2.5">
                    <Skeleton shape="circle" className="size-10 shrink-0" />
                    <span className="flex flex-1 flex-col gap-2 pt-1">
                      <Skeleton className="w-2/5" />
                      <Skeleton className="w-4/5" />
                    </span>
                  </span>
                ))}
              </SkeletonGroup>
            )}
          </div>

          <Link
            href={ROUTES.notifications}
            onClick={() => setOpen(false)}
            className="flex min-h-11 items-center justify-center rounded-b-card border-t border-line px-4 font-bold text-primary no-underline transition-colors duration-150 hover:bg-primary-soft"
          >
            See all notifications
          </Link>
        </section>
      )}
    </div>
  );
}
