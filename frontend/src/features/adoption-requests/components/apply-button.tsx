"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { buttonClasses } from "@/components/ui/button-styles";
import { StatusBadge } from "@/components/ui/status-badge";
import { REQUEST_COOLDOWN_DAYS } from "@/constants/adoption-requests";
import { applyPath, requestPath } from "@/constants/routes";
import { REQUEST_STATUS_LABELS } from "@/constants/statuses";
import { formatDate } from "@/lib/utils/format-date";
import { ApplyBlockedDialog } from "../dialogs/apply-blocked-dialog";
import { type ApplyState, isApplyBlocker } from "../schemas/apply-state";

type Props = {
  home: { id: number; full_name: string };
  /** What the pet's own requests allow (`applyStateFor`), worked out on the server. */
  state: ApplyState;
};

// Apply on a Home Profile (DS-07, FR24). It opens the Send request form (RQ-03); with a request already open,
// "View my request" takes its place, so a home never gets two from the same pet. When a rule is in the way, Apply
// explains it in a dialog instead of opening a form the API would refuse: 3 open requests (RQ-05), the 30-day
// cooldown (RQ-06), or a request already in process. The API refuses whatever this shows (SEC-FE-05).
export function ApplyButton({ home, state }: Props) {
  const [open, setOpen] = useState(false);

  if (state.kind === "open") {
    return (
      <>
        <Link href={requestPath(state.requestId)} className={buttonClasses({ variant: "primary" })}>
          View my request
        </Link>
        <StatusBadge status={REQUEST_STATUS_LABELS[state.status]} />
      </>
    );
  }

  if (state.kind === "not_accepting") return <Button disabled>Not accepting requests</Button>;

  if (!isApplyBlocker(state)) {
    return (
      <Link href={applyPath(home.id)} className={buttonClasses({ variant: "primary" })}>
        Apply for this home
      </Link>
    );
  }

  return (
    <>
      <Button variant="primary" aria-haspopup="dialog" onClick={() => setOpen(true)}>
        Apply for this home
      </Button>
      {state.kind === "cooldown" && (
        // After the other actions, on a line of its own.
        <p className="order-last basis-full text-sm text-ink-muted">
          You can apply to this home again on {formatDate(state.until)}. After a Declined or Not Adopted result, a pet waits {REQUEST_COOLDOWN_DAYS}{" "}
          days.
        </p>
      )}
      <ApplyBlockedDialog open={open} onClose={() => setOpen(false)} blocker={state} homeName={home.full_name} />
    </>
  );
}
