"use client";

import { useState } from "react";
import { AnnouncementDialog } from "@/components/overlays/announcement-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/utils/format-date";
import type { PublishedAnnouncement } from "../types/announcements";

// The Announcements tab of Notifications (NT-02, NT-03): what the Pawfolio team published for this account's role,
// newest first. Each one shows its title, its date and the start of its message; "Read announcement" opens the
// whole of it on this page. They are listed whether or not an alert was delivered for them, so an account approved
// after one went out still finds it here. An admin's words, rendered as text (SEC-FE-01).
export function PublishedAnnouncements({ announcements }: { announcements: PublishedAnnouncement[] }) {
  // The one being read. It stays set while the dialog closes, so the text doesn't empty on the way out.
  const [reading, setReading] = useState<PublishedAnnouncement | null>(null);
  const [open, setOpen] = useState(false);

  return (
    <>
      <Card as="div" padding="none">
        <ul className="flex flex-col divide-y divide-line">
          {announcements.map((announcement) => (
            <li key={announcement.id} className="flex flex-col items-start gap-1 px-4 py-4">
              <h2 className="font-sans text-base font-bold wrap-break-word">{announcement.title}</h2>
              {announcement.published_at && (
                <time dateTime={announcement.published_at} className="text-xs text-ink-muted">
                  {formatDate(announcement.published_at)}
                </time>
              )}
              <p className="line-clamp-3 text-sm wrap-break-word whitespace-pre-line text-ink-muted">{announcement.message}</p>
              <Button
                variant="tertiary"
                size="sm"
                aria-haspopup="dialog"
                // Pulled left by its own padding, so the words line up with the text above.
                className="-ml-3"
                onClick={() => {
                  setReading(announcement);
                  setOpen(true);
                }}
              >
                Read announcement
                <span className="sr-only">: {announcement.title}</span>
              </Button>
            </li>
          ))}
        </ul>
      </Card>
      <AnnouncementDialog announcement={reading} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
