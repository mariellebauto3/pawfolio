import type { ReactNode } from "react";
import { meetingTimeParts } from "@/lib/utils/format-date";
import type { MeetGreetSlot } from "@/types/meet-and-greet";
import { slotPlace, slotPlaceKind } from "../schemas/slots";
import { DateLeaf } from "./date-leaf";

type Props = {
  slot: MeetGreetSlot;
  tone?: "open" | "pending" | "confirmed";
  /** What goes under the place: a badge, who booked it. */
  children?: ReactNode;
};

// One slot in a line: the day as a leaf, then the time and the place. The place a human typed is rendered as plain
// text (SEC-FE-01).
export function SlotLine({ slot, tone, children }: Props) {
  const kind = slotPlaceKind(slot);

  return (
    <div className="flex min-w-0 items-center gap-3">
      <DateLeaf at={slot.starts_at} tone={tone} />
      <div className="flex min-w-0 flex-col gap-0.5">
        {/* The leaf reads the whole date and time out; this repeats the time for the eye. */}
        <span aria-hidden="true" className="font-bold">
          {meetingTimeParts(slot.starts_at)?.time}
        </span>
        <span className="wrap-break-word">{slotPlace(slot)}</span>
        {kind && <span className="text-sm text-ink-muted">{kind}</span>}
        {children}
      </div>
    </div>
  );
}
