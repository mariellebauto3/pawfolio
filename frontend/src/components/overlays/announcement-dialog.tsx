"use client";

import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils/format-date";
import type { IsoDateTime } from "@/types/api";
import { Modal } from "./modal";

/** What the dialog reads of an announcement, whether it came as a notification or from the list of announcements. */
export type AnnouncementToRead = {
  title: string;
  message: string;
  /** When it went out; null when the API didn't say. */
  published_at: IsoDateTime | null;
};

type Props = {
  /** The announcement to show. It keeps showing while the dialog closes, so pass the last one rather than null. */
  announcement: AnnouncementToRead | null;
  open: boolean;
  onClose: () => void;
};

// An announcement read in full, where the person already is: from its row on Notifications, from the Alerts
// dropdown, from the Announcements tab (NT-01…NT-03). An explanation, so it is a dialog (ui-guidelines §5). The
// title and the message are an admin's words and are rendered as text, with nothing in them made into a link
// (SEC-FE-01, SEC-FE-02).
export function AnnouncementDialog({ announcement, open, onClose }: Props) {
  if (!announcement) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={announcement.title}
      subtitle={
        announcement.published_at ? (
          <>
            Announcement from the Pawfolio team, <time dateTime={announcement.published_at}>{formatDate(announcement.published_at)}</time>
          </>
        ) : (
          "Announcement from the Pawfolio team"
        )
      }
      footer={
        <Button variant="primary" onClick={onClose}>
          Close
        </Button>
      }
    >
      <p className="wrap-break-word whitespace-pre-line">{announcement.message}</p>
    </Modal>
  );
}
