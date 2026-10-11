"use client";

import type { ReactNode } from "react";
import { RadioCards } from "@/components/forms/radio-cards";
import { Badge } from "@/components/ui/badge";
import { formatMeetingTime } from "@/lib/utils/format-date";
import type { MeetGreetSlot } from "@/types/meet-and-greet";
import { slotPlace, slotPlaceKind } from "../schemas/slots";

type Props = {
  legend: ReactNode;
  slots: MeetGreetSlot[];
  /** The id of the chosen slot as text; empty while none is. */
  value: string;
  onChange: (value: string) => void;
  error?: ReactNode;
  disabled?: boolean;
  /** The slot the human offered instead (MG-06), marked so the pet finds it. */
  offered?: { slotId: number; by: string } | null;
  name?: string;
};

// The open slots to choose one from: booking (MG-03), proposing another time (MG-06) and rescheduling (MG-09). Each
// is a day, a time and a place, soonest first, in Philippine time.
export function SlotChoices({ legend, slots, value, onChange, error, disabled, offered, name = "slot_id" }: Props) {
  const options = slots.map((slot) => ({
    value: String(slot.id),
    label: (
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {formatMeetingTime(slot.starts_at)}
        {offered?.slotId === slot.id && <Badge tone="attention">Offered by {offered.by}</Badge>}
      </span>
    ),
    description: [slotPlace(slot), slotPlaceKind(slot)].filter(Boolean).join(" · "),
  }));

  return (
    <RadioCards
      legend={legend}
      name={name}
      options={options}
      value={value}
      onChange={onChange}
      error={error}
      disabled={disabled}
      required
    />
  );
}
