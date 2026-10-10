"use client";

import Link from "next/link";
import { Icon, type IconName } from "@/components/ui/icon";
import { cn } from "@/lib/utils/cn";
import { formatDateTime } from "@/lib/utils/format-date";
import { notificationHref } from "@/lib/utils/notification-href";
import type { Notification, NotificationCategory } from "@/types/notification";

const CATEGORY_ICONS: Record<NotificationCategory, IconName> = {
  // The same icons as the pages they are about: Requests in the top bar, a meeting's day, the account, the Home feed.
  requests: "briefcase",
  meet_and_greets: "calendar",
  account: "user",
  feed: "home",
};

function iconFor({ type, category }: Pick<Notification, "type" | "category">): IconName {
  if (type === "announcement") return "info";
  return category ? CATEGORY_ICONS[category] : "bell";
}

type Props = {
  notification: Notification;
  /** "2h ago". Worked out by whoever renders the list, so a page rendered on the server keeps the text it sent. */
  when: string;
  unread: boolean;
  /** Runs when the row is opened: the list marks it as read, the dropdown also closes. */
  onOpen?: () => void;
  /**
   * For an announcement: opens it to be read in full, right where the list is (`AnnouncementDialog`). The row is
   * then a button, and `action_url` isn't followed. Leave out and an announcement behaves like any other row.
   */
  onRead?: () => void;
  /** `compact` in the Alerts dropdown (NT-01): the message stops after two lines and the time sits under it. */
  density?: "compact" | "comfortable";
};

// One notification in a list (NT-01…NT-03). The whole row is one link to what it is about. Unread shows three ways,
// never by colour alone: a tinted row, a dot, and "Unread" for screen readers. Blue on the icon means someone must
// act (HiFi palette), and is read out as "Important". Title and message are text from the API and from other
// people (an invite's note, a comment), so they are rendered as text only (SEC-FE-01).
//
// An announcement is the one row that is read rather than followed: it shows the start of its message as a
// preview, says so ("Announcement"), and opens in full where the list is.
export function NotificationRow({ notification, when, unread, onOpen, onRead, density = "comfortable" }: Props) {
  const announcement = notification.type === "announcement" && onRead !== undefined;
  const href = announcement ? null : notificationHref(notification.action_url);
  const important = notification.urgency !== "info";
  const compact = density === "compact";

  const time = (className: string) => (
    <time dateTime={notification.created_at} title={formatDateTime(notification.created_at)} className={cn("text-xs whitespace-nowrap text-ink-muted", className)}>
      {when}
    </time>
  );

  const content = (
    <>
      <span
        className={cn(
          "grid size-10 shrink-0 place-items-center rounded-pill border",
          important ? "border-primary bg-primary text-primary-ink" : "border-line bg-surface text-ink-muted",
        )}
      >
        <Icon name={iconFor(notification)} className="size-5" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        {announcement && <span className="text-xs font-bold text-primary">Announcement</span>}
        <span className={cn("font-bold text-ink", (href || announcement) && "group-hover:underline")}>
          {(unread || important) && (
            <span className="sr-only">
              {unread && "Unread. "}
              {important && "Important. "}
            </span>
          )}
          {notification.title}
        </span>
        <span
          className={cn(
            "text-sm wrap-break-word",
            // The preview of an announcement stops after a few lines; the dialog has the rest.
            announcement ? cn("whitespace-pre-line", compact ? "line-clamp-2" : "line-clamp-3") : compact && "line-clamp-2",
            unread ? "text-ink" : "text-ink-muted",
          )}
        >
          {notification.body}
        </span>
        {announcement && !compact && <span className="text-sm font-bold text-primary">Read announcement</span>}
        {time(compact ? "" : "md:hidden")}
      </span>
      {!compact && time("mt-0.5 hidden md:block")}
      {/* Kept when read, so the text doesn't move as the dot goes. */}
      <span aria-hidden="true" className={cn("mt-1.5 size-2.5 shrink-0 rounded-pill", unread && "bg-primary")} />
    </>
  );

  const classes = cn(
    "group flex w-full items-start gap-3 text-left text-ink no-underline transition-colors duration-150",
    compact ? "rounded-control px-2.5 py-2.5" : "px-4 py-4",
    unread ? "bg-primary-soft" : (href || announcement) && "hover:bg-surface-sunken",
  );

  if (announcement) {
    return (
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => {
          onOpen?.();
          onRead();
        }}
        className={classes}
      >
        {content}
      </button>
    );
  }

  if (href) {
    return (
      // Not prefetched: a page of rows would load twenty pages nobody asked for yet.
      <Link href={href} prefetch={false} onClick={onOpen} className={classes}>
        {content}
      </Link>
    );
  }

  // It leads nowhere: pressing it is how an unread one is marked as read.
  if (unread && onOpen) {
    return (
      <button type="button" onClick={onOpen} className={classes}>
        {content}
      </button>
    );
  }

  return <div className={classes}>{content}</div>;
}
