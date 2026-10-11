"use client";

import { useId, useState } from "react";
import { NotificationRow } from "@/components/data-display/notification-row";
import { AnnouncementDialog } from "@/components/overlays/announcement-dialog";
import { Card } from "@/components/ui/card";
import { useAlerts } from "@/providers/alerts-provider";
import type { Notification } from "@/types/notification";

export type NotificationListRow = {
  notification: Notification;
  /** "2h ago", written by the page as it rendered, so the server and the browser show the same text. */
  when: string;
};

/** Rows of one age under their heading: "Today", "This week", "September 2026" (`groupByAge`). */
export type NotificationListGroup = { id: string; heading: string; rows: NotificationListRow[] };

// One page of the Notifications screen (NT-02, NT-03), newest first, in sections by age, so it reads as a history:
// what came today, this week, and month by month before that. Opening a row marks it as read: the count on Alerts
// drops at once, and the row stays read if this page is shown again from the browser's history. An announcement
// opens in a dialog on this page, with its whole message.
export function NotificationList({ groups }: { groups: NotificationListGroup[] }) {
  const alerts = useAlerts();
  const headingId = useId();
  // The announcement being read. It stays set while the dialog closes, so the text doesn't empty on the way out.
  const [reading, setReading] = useState<Notification | null>(null);
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="flex flex-col gap-5">
        {groups.map((group) => (
          <section key={group.id} aria-labelledby={`${headingId}-${group.id}`} className="flex flex-col gap-2">
            <h2 id={`${headingId}-${group.id}`} className="px-1 font-sans text-sm font-bold text-ink-muted">
              {group.heading}
            </h2>
            <Card as="div" padding="none">
              <ul className="flex flex-col divide-y divide-line">
                {group.rows.map(({ notification, when }) => {
                  const unread = alerts ? alerts.isUnread(notification) : !notification.is_read;
                  return (
                    <li key={notification.id}>
                      <NotificationRow
                        notification={notification}
                        when={when}
                        unread={unread}
                        onOpen={unread && alerts ? () => alerts.markRead(notification) : undefined}
                        onRead={() => {
                          setReading(notification);
                          setOpen(true);
                        }}
                      />
                    </li>
                  );
                })}
              </ul>
            </Card>
          </section>
        ))}
      </div>
      <AnnouncementDialog
        announcement={reading && { title: reading.title, message: reading.body, published_at: reading.created_at }}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
