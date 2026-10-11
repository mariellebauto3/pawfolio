"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { isApiError } from "@/lib/api/errors";
import { useAlerts } from "@/providers/alerts-provider";
import { useToast } from "@/providers/toast-provider";

// "Mark all as read" on the Notifications page (NT-02, NT-03). It covers every notification of the account, on
// every tab and page, as the same button in the Alerts dropdown does. Nothing to press when nothing is unread.
export function MarkAllReadButton() {
  const alerts = useAlerts();
  const toast = useToast();
  const [marking, setMarking] = useState(false);
  if (!alerts) return null;

  async function markAllRead() {
    if (!alerts) return;
    setMarking(true);
    try {
      await alerts.markAllRead();
      toast.show("All notifications marked as read.");
    } catch (error) {
      if (!isApiError(error)) throw error;
      toast.show(error.message, { tone: "error" });
    } finally {
      setMarking(false);
    }
  }

  return (
    <Button size="sm" loading={marking} loadingLabel="Marking all as read" disabled={alerts.unreadCount === 0 && !marking} onClick={markAllRead}>
      Mark all as read
    </Button>
  );
}
