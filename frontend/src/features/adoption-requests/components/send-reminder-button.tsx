"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import { useToast } from "@/providers/toast-provider";
import { sendRequestReminder } from "../api/admin-requests";

type Props = {
  requestId: number;
  /** Who the reminder goes to, so the button says so before it is pressed. */
  recipientName: string;
};

const UNKNOWN_PROBLEM = "The reminder didn't go through. Check your connection and try again.";

// "Send reminder" on a request's record (RQ-19, FR36): one in-app notification to the side the request waits on.
// Only the request's id is sent; who is reminded and in which words is the API's to say, and it logs the reminder
// with the admin's name. It is offered only when the API says one can go out (SEC-FE-05); if that changed in the
// meantime the API's own words are shown, and the page is read again either way.
export function SendReminderButton({ requestId, recipientName }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function send() {
    if (busy) return;
    setBusy(true);
    try {
      const sent = await sendRequestReminder(api, requestId);
      toast.show(`Reminder sent to ${sent.recipient_name ?? recipientName}.`);
    } catch (failure) {
      const refused = isApiError(failure) && failure.kind === "conflict";
      toast.show(isApiError(failure) ? failure.message : UNKNOWN_PROBLEM, { tone: refused ? "info" : "error" });
      if (!refused) return setBusy(false);
    }
    // The page says when the last reminder went out and takes the button away until another may be sent.
    router.refresh();
    setBusy(false);
  }

  return (
    <Button size="sm" onClick={send} loading={busy} loadingLabel="Sending the reminder">
      Remind {recipientName}
    </Button>
  );
}
