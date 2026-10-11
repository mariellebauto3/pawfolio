"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { REQUEST_COOLDOWN_DAYS } from "@/constants/adoption-requests";
import { useToast } from "@/providers/toast-provider";
import { ApproveRequestDialog } from "../dialogs/approve-request-dialog";
import { DeclineRequestDialog } from "../dialogs/decline-request-dialog";

type Props = {
  request: { id: number; petName: string };
};

// Approve and Decline on a new request (RQ-11, FR10). Each opens its dialog (RQ-12, RQ-13). Once the API has
// taken the answer, the page is read again so the status, the path and the history follow, and a toast confirms,
// since a toast can't be seen while a dialog is open. The buttons leave with the old panel; its frame takes the
// focus (`RequestPanelFrame`). They only show while the request is Sent; the API refuses an answer to any other,
// whatever is on the screen (SEC-FE-05).
export function AnswerRequestButtons({ request }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState<"approve" | "decline" | null>(null);
  const close = () => setOpen(null);

  function answered(message: string) {
    toast.show(message);
    router.refresh();
  }

  return (
    <>
      <div className="flex flex-wrap gap-3">
        <Button variant="primary" aria-haspopup="dialog" onClick={() => setOpen("approve")}>
          Approve
        </Button>
        <Button aria-haspopup="dialog" onClick={() => setOpen("decline")}>
          Decline
        </Button>
      </div>
      <ApproveRequestDialog
        open={open === "approve"}
        onClose={close}
        request={request}
        onApproved={() => answered(`Request approved. ${request.petName} can now book a Meet & Greet with you.`)}
        // The page behind shows a status the request no longer has.
        onStale={() => router.refresh()}
      />
      <DeclineRequestDialog
        open={open === "decline"}
        onClose={close}
        request={request}
        onDeclined={() => answered(`Request declined. ${request.petName} can apply again in ${REQUEST_COOLDOWN_DAYS} days.`)}
        onStale={() => router.refresh()}
      />
    </>
  );
}
