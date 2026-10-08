"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmDialog } from "@/components/overlays/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { buttonClasses } from "@/components/ui/button-styles";
import { StatusBadge } from "@/components/ui/status-badge";
import { requestPath } from "@/constants/routes";
import { api } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import { formatMeetingTime } from "@/lib/utils/format-date";
import { useToast } from "@/providers/toast-provider";
import { removeSlot } from "../api/slots";
import { slotPlace } from "../schemas/slots";
import type { UpcomingSlot } from "../types/meetings";
import { SlotLine } from "./slot-line";

type Props = {
  slots: UpcomingSlot[];
};

// MG-01 "Upcoming slots": every slot still ahead, soonest first. An open slot can be removed; a booked one names
// the pet and leads to its request, where the booking is confirmed, moved or cancelled. Rows instead of the LoFi's
// table, so a phone reads them without scrolling sideways. The API refuses to remove a slot a pet has booked,
// whatever this shows (SEC-FE-05).
export function UpcomingSlots({ slots }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [removing, setRemoving] = useState<UpcomingSlot | null>(null);

  async function remove(slot: UpcomingSlot) {
    try {
      await removeSlot(api, slot.id);
      toast.show("Slot removed.");
    } catch (failure) {
      // Booked in the meantime, or gone already: the list behind is out of date, and the API says which.
      if (!isApiError(failure) || (failure.kind !== "conflict" && failure.kind !== "not_found")) throw failure;
      toast.show(failure.kind === "conflict" ? failure.message : "That slot was already removed.", { tone: "error" });
    }
    router.refresh();
  }

  return (
    <>
      <ul className="flex flex-col divide-y divide-line">
        {slots.map((slot) => {
          const { booking } = slot;
          const waiting = booking?.status === "booked";
          return (
            <li key={slot.id} className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
              <SlotLine slot={slot} tone={booking ? (waiting ? "pending" : "confirmed") : "open"}>
                <span className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                  {!booking && <Badge tone="progress">Open</Badge>}
                  {booking && (waiting ? <Badge tone="attention">Confirm needed</Badge> : <StatusBadge status="Meet Scheduled" />)}
                  {booking && <span className="wrap-break-word text-ink-muted">Booked by {booking.pet_name}</span>}
                </span>
              </SlotLine>

              {booking ? (
                <Link
                  href={requestPath(booking.adoption_request_id)}
                  className={buttonClasses({ variant: waiting ? "primary" : "secondary", size: "sm", className: "self-start sm:self-center" })}
                >
                  {waiting ? "Review booking" : "View request"}
                  <span className="sr-only"> from {booking.pet_name}</span>
                </Link>
              ) : (
                <Button variant="tertiary" size="sm" aria-haspopup="dialog" onClick={() => setRemoving(slot)} className="self-start sm:self-center">
                  Remove
                  <span className="sr-only"> the slot on {formatMeetingTime(slot.starts_at)}</span>
                </Button>
              )}
            </li>
          );
        })}
      </ul>

      <ConfirmDialog
        open={removing !== null}
        onClose={() => setRemoving(null)}
        title="Remove this slot?"
        subtitle={removing ? `${formatMeetingTime(removing.starts_at)} at ${slotPlace(removing)}` : undefined}
        confirmLabel="Remove slot"
        cancelLabel="Keep slot"
        destructive
        consequences={["Pets can no longer book this time.", "You can add it again whenever you like."]}
        onConfirm={() => (removing ? remove(removing) : undefined)}
      />
    </>
  );
}
