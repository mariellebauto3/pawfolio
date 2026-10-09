"use client";

import { NotificationRow } from "@/components/data-display/notification-row";
import { Card } from "@/components/ui/card";
import { useAlerts } from "@/providers/alerts-provider";
import type { Notification } from "@/types/notification";

export type NotificationListRow = {
  notification: Notification;
  /** "2h ago", written by the page as it rendered, so the server and the browser show the same text. */
  when: string;
};

// One page of the Notifications screen (NT-02, NT-03), newest first. Opening a row marks it as read: the count on
// Alerts drops at once, and the row stays read if this page is shown again from the browser's history.
export function NotificationList({ rows }: { rows: NotificationListRow[] }) {
  const alerts = useAlerts();

  return (
    <Card as="div" padding="none">
      <ul className="flex flex-col divide-y divide-line">
        {rows.map(({ notification, when }) => {
          const unread = alerts ? alerts.isUnread(notification) : !notification.is_read;
          return (
            <li key={notification.id}>
              <NotificationRow notification={notification} when={when} unread={unread} onOpen={unread && alerts ? () => alerts.markRead(notification) : undefined} />
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
