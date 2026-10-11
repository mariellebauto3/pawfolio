"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/providers/toast-provider";
import type { AdoptionRequest } from "@/types/adoption-request";
import { WithdrawRequestDialog } from "../dialogs/withdraw-request-dialog";
import { requestsHref } from "../schemas/requests";

type Props = {
  request: Pick<AdoptionRequest, "id" | "status" | "home_profile">;
};

// Withdraw on a request the pet sent (RQ-14, RQ-15 and every status before the final decision, FR25). It opens
// the dialog (RQ-16). Once the request is withdrawn the pet lands on the Closed tab of My requests, where it now
// is, with a toast, since a toast can't be seen while a dialog is open.
export function WithdrawRequestButton({ request }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button size="sm" aria-haspopup="dialog" onClick={() => setOpen(true)} className="self-start">
        Withdraw request
      </Button>
      <WithdrawRequestDialog
        open={open}
        onClose={() => setOpen(false)}
        request={request}
        onWithdrawn={() => {
          toast.show(`Request withdrawn. You can apply to ${request.home_profile.full_name} again any time.`);
          router.push(requestsHref("closed"));
          router.refresh();
        }}
        // The page behind shows a status the request no longer has.
        onStale={() => router.refresh()}
      />
    </>
  );
}
