"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { Alert } from "@/components/feedback/alert";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api/client";
import { useToast } from "@/providers/toast-provider";
import type { MeetGreetSlot } from "@/types/meet-and-greet";
import { bookSlot } from "../api/meetings";
import { SlotChoices } from "../components/slot-choices";
import { useMeetChange } from "../hooks/use-meet-change";

type Props = {
  requestId: number;
  homeName: string;
  /** The home's open slots, soonest first; the offered one leads when there is one. */
  slots: MeetGreetSlot[];
  /** The slot the human offered instead (MG-06), when it can still be booked. */
  offeredId: number | null;
};

const UNKNOWN_PROBLEM = "We couldn't book the slot. Check your connection and try again.";

// MG-03 Book a slot: the pet picks one of the home's open slots on an Approved request (FR26). The first is chosen
// to begin with, or the one the human offered. Once the API has taken the booking, the page is read again and
// shows it waiting for the human to confirm (MG-04). The API decides whether the slot can still be taken, whatever
// this lists (SEC-FE-05).
export function BookSlotForm({ requestId, homeName, slots, offeredId }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [picked, setPicked] = useState(String(offeredId ?? slots[0]?.id ?? ""));
  const { busy, problem, run, settle } = useMeetChange(UNKNOWN_PROBLEM);
  // A slot someone else just took leaves the list when the page is read again: the first one left is chosen.
  const chosen = slots.find((slot) => String(slot.id) === picked) ?? slots[0] ?? null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!chosen) return;
    if (!(await run(() => bookSlot(api, requestId, chosen.id)))) return;
    toast.show(`Slot booked. ${homeName} will confirm it.`);
    router.refresh();
    settle();
  }

  if (!chosen) {
    return (
      <Alert tone="info" title={`${homeName} has no open slots right now`} action={<Button size="sm" onClick={() => router.refresh()}>Check again</Button>}>
        New slots show up here as soon as they add one.
      </Alert>
    );
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-3">
      <SlotChoices
        legend="Open slots"
        slots={slots}
        value={String(chosen.id)}
        onChange={setPicked}
        disabled={busy}
        offered={offeredId === null ? null : { slotId: offeredId, by: homeName }}
      />
      {problem && (
        <Alert tone="error" announce>
          {problem}
        </Alert>
      )}
      <Button type="submit" variant="primary" loading={busy} loadingLabel="Booking the slot">
        Book this slot
      </Button>
    </form>
  );
}
