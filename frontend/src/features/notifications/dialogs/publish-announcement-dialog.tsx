"use client";

import { useState } from "react";
import { NotificationRow } from "@/components/data-display/notification-row";
import { Alert } from "@/components/feedback/alert";
import { Modal } from "@/components/overlays/modal";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api/client";
import { type FieldErrors, isApiError } from "@/lib/api/errors";
import type { Notification } from "@/types/notification";
import { publishAnnouncement } from "../api/announcements";
import { audienceLine, scheduledFor } from "../schemas/announcements";
import type { AudienceCounts, NewAnnouncement, StoredAnnouncement } from "../types/announcements";

type Props = {
  /** The announcement as it will be sent. The dialog is open while there is one. */
  announcement: NewAnnouncement | null;
  counts: AudienceCounts;
  /** Back to editing, with everything typed still in the form. */
  onClose: () => void;
  /** It was stored; the dialog has closed. */
  onStored: (stored: StoredAnnouncement) => void;
  /** The API refused a field (422): the dialog has closed and the form shows the message under it. */
  onInvalid: (errors: FieldErrors) => void;
};

const UNKNOWN_PROBLEM = "That didn't go through. Check your connection and try again.";

export function PublishAnnouncementDialog(props: Props) {
  // Mounted only while there is something to confirm, so a failed try doesn't linger into the next one.
  return props.announcement ? <Confirmation {...props} announcement={props.announcement} /> : null;
}

// NT-05 Publish announcement: the last look before it goes out. The preview is the row recipients will see in
// their Alerts, drawn by the same component, with the admin's words as text (SEC-FE-01). An announcement can't be
// changed or taken back afterwards, and there is no way to cancel a scheduled one, so the dialog says so before the
// button is pressed. The button is ignored while a publish is on its way, so one press sends one announcement.
function Confirmation({ announcement, counts, onClose, onStored, onInvalid }: Props & { announcement: NewAnnouncement }) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const scheduled = announcement.publish_at !== null;
  const count = counts[announcement.audience];

  // What lands in Alerts, as the API writes it: an announcement's own icon, no link to follow from a preview.
  const preview: Notification = {
    id: "preview",
    type: "announcement",
    category: "account",
    title: announcement.title,
    body: announcement.message,
    is_read: false,
    urgency: "info",
    action_url: null,
    created_at: announcement.publish_at ?? new Date().toISOString(),
  };

  async function publish() {
    if (busy) return;
    setBusy(true);
    setProblem(null);
    try {
      const stored = await publishAnnouncement(api, announcement);
      onClose();
      onStored(stored);
    } catch (failure) {
      setBusy(false);
      if (!isApiError(failure)) return setProblem(UNKNOWN_PROBLEM);
      if (failure.kind === "validation") {
        onClose();
        return onInvalid(failure.fieldErrors);
      }
      setProblem(failure.message);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={scheduled ? "Schedule announcement?" : "Publish announcement?"}
      subtitle="This is what each account reads in its Alerts."
      size="lg"
      dismissible={!busy}
      closeOnBackdrop={false}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Back to editing
          </Button>
          <Button variant="primary" onClick={publish} loading={busy} loadingLabel={scheduled ? "Scheduling the announcement" : "Publishing the announcement"}>
            {scheduled ? "Schedule announcement" : "Publish now"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {problem && (
          <Alert tone="error" announce>
            {problem}
          </Alert>
        )}

        <div className="overflow-hidden rounded-card border border-line">
          <NotificationRow notification={preview} when={scheduled ? "On the day" : "Just now"} unread />
        </div>

        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
          <dt className="text-ink-muted">Audience</dt>
          <dd>{audienceLine(announcement.audience, counts)}</dd>
          <dt className="text-ink-muted">When</dt>
          <dd>{announcement.publish_at ? `${scheduledFor(announcement.publish_at)}, Philippine time` : "Now"}</dd>
          <dt className="text-ink-muted">Delivery</dt>
          <dd>An alert for each account, and a card beside the feed</dd>
        </dl>

        {count === 0 && (
          <Alert tone="warning" title="Nobody is in this audience right now">
            No Active account will get an alert. It will still show on the feed for accounts approved later.
          </Alert>
        )}

        <p className="text-sm text-ink-muted">
          {scheduled
            ? "Once scheduled, an announcement can’t be edited or cancelled: it goes out at that time. It is logged with your name."
            : "Once published, an announcement can’t be edited or taken back. It is logged with your name."}
        </p>
      </div>
    </Modal>
  );
}
