import type { CancelReason, DidntHappenReason, MeetAndGreet, MeetGreetSlot } from "@/types/meet-and-greet";
import type { RequestStatus } from "@/types/statuses";
import type { RequestMeeting } from "../types/meetings";

// How the Meet & Greet of a request is told to its two readers (MG-03…MG-14, proposal §5.4;
// docs/api/adoption-and-meet-greet.md). The request's status and every booking are the API's; nothing here decides
// one (FR27).

/** Who is reading: the pet that sent the request, or the human it was sent to. */
export type MeetReader = "pet" | "human";

/**
 * Where the Meet & Greet of a request stands, which chooses the panel:
 * `book` (MG-03: Approved, no booking), `booked` (MG-04, MG-05: waiting for the human to confirm), `scheduled`
 * (MG-07, MG-08: confirmed and still ahead), `decide` (MG-11, MG-12: its time has passed, so the human decides).
 * Null for every request that isn't at this step.
 */
export type MeetStage = "book" | "booked" | "scheduled" | "decide";

export function meetStage(status: RequestStatus, meeting: Pick<RequestMeeting, "active"> & Partial<Pick<RequestMeeting, "passed">>): MeetStage | null {
  const booking = meeting.active;
  if (status === "approved") return booking === null ? "book" : booking.status === "booked" ? "booked" : null;
  // The API moves the status within minutes of the meeting time; the decision is open from the time itself.
  if (status === "awaiting_decision") return "decide";
  if (status === "meet_scheduled") return meeting.passed ? "decide" : booking?.status === "confirmed" ? "scheduled" : null;
  return null;
}

/** The meeting a decision is about: the booking that still stands, or the one that ended when its time came. */
export function metSlot(meeting: Pick<RequestMeeting, "active" | "latest">): MeetGreetSlot | null {
  return meeting.active?.slot ?? meeting.latest?.slot ?? null;
}

/** The reasons the Cancel meeting dialog offers (MG-10), as the API's enum names them. One is always required. */
export const CANCEL_REASON_LABELS = {
  schedule_conflict: "Schedule conflict",
  pet_unwell: "Pet is unwell",
  weather_or_travel: "Weather or travel problem",
  other: "Other",
} as const satisfies Record<CancelReason, string>;

export const CANCEL_REASONS = Object.keys(CANCEL_REASON_LABELS) as CancelReason[];

const isCancelReason = (value: unknown): value is CancelReason => (CANCEL_REASONS as unknown[]).includes(value);

/**
 * What the "It didn't happen" dialog offers (MG-13), in the human's own words, as the API's enum names them. One is
 * always required.
 */
export const DIDNT_HAPPEN_LABELS = {
  didnt_show_pet_side: "The pet’s side didn’t show up",
  didnt_show_human_side: "I couldn’t make it",
  moved_to_another_day: "We moved it to another day",
  other: "Something else",
} as const satisfies Record<DidntHappenReason, string>;

export const DIDNT_HAPPEN_REASONS = Object.keys(DIDNT_HAPPEN_LABELS) as DidntHappenReason[];

const isDidntHappenReason = (value: unknown): value is DidntHappenReason => (DIDNT_HAPPEN_REASONS as unknown[]).includes(value);

/** The same four as the pet's side reads them: the human is named, and "the pet's side" becomes "your side". */
export function didntHappenTold(reason: DidntHappenReason, homeName: string): string {
  const told: Record<DidntHappenReason, string> = {
    didnt_show_pet_side: `${homeName} reported that your side didn’t show up.`,
    didnt_show_human_side: `${homeName} couldn’t make it.`,
    moved_to_another_day: `${homeName} said it was moved to another day.`,
    other: `${homeName} reported that it didn’t take place.`,
  };
  return told[reason];
}

/**
 * A message with a proposal (MG-06), the reason of a reschedule (MG-09), the details of a cancellation (MG-10) or
 * of a meeting that didn't happen (MG-13), and a message with a decline after the meeting (MG-14), after trimming.
 */
export const MEET_NOTE_MAX = 600;

/** The message for a note that can't be sent, or null when it can. `what` names it: "message", "reason", "details". */
export function validateMeetNote(typed: string, what: string): string | null {
  return typed.trim().length > MEET_NOTE_MAX ? `Keep the ${what} to ${MEET_NOTE_MAX} characters or fewer.` : null;
}

/** The note as it is sent: trimmed, and nothing at all when it is empty. */
export function meetNote(typed: string): string | null {
  const note = typed.trim();
  return note === "" ? null : note;
}

/**
 * Why booking is open again, read from the last booking once nothing is booked: the human offered another time
 * (MG-06), one side called the meeting off (MG-10), or it was reported as not having happened (MG-13).
 */
export type BookingNotice =
  | { kind: "proposed"; byReader: boolean; slot: MeetGreetSlot; message: string | null }
  | { kind: "cancelled"; byReader: boolean; was: MeetGreetSlot | null; reason: string; details: string | null }
  | { kind: "didnt_happen"; was: MeetGreetSlot | null; reason: DidntHappenReason | null; details: string | null };

export function bookingNotice(latest: MeetAndGreet | null, reader: MeetReader): BookingNotice | null {
  if (!latest || latest.status !== "ended" || latest.end_reason === null) return null;
  const byReader = latest.ended_by === reader;

  // Its time had come before it ended: it was reported afterwards, not called off beforehand.
  const startsAt = latest.slot ? new Date(latest.slot.starts_at).getTime() : Number.NaN;
  const endedAt = latest.ended_at ? new Date(latest.ended_at).getTime() : Number.NaN;
  if (startsAt <= endedAt) {
    // Only the human reports what happened (MG-13); anything else that ended it afterwards is told without one.
    const reason = latest.ended_by === "human" && isDidntHappenReason(latest.end_reason) ? latest.end_reason : null;
    return { kind: "didnt_happen", was: latest.slot, reason, details: reason ? latest.end_details : null };
  }

  if (latest.end_reason === "moved_to_another_day") {
    // A pet that moves its booking has a new one already; only a human's offer leaves booking open.
    return latest.ended_by === "human" && latest.proposed_slot
      ? { kind: "proposed", byReader, slot: latest.proposed_slot, message: latest.end_details }
      : null;
  }
  if (isCancelReason(latest.end_reason)) {
    return { kind: "cancelled", byReader, was: latest.slot, reason: CANCEL_REASON_LABELS[latest.end_reason], details: latest.end_details };
  }
  return null;
}

/** The offered slot, when the pet can still book it: it leads the list. Otherwise the slots as they are. */
export function slotsWithOfferFirst(slots: MeetGreetSlot[], notice: BookingNotice | null): { slots: MeetGreetSlot[]; offeredId: number | null } {
  if (notice?.kind !== "proposed") return { slots, offeredId: null };
  const offered = slots.find((slot) => slot.id === notice.slot.id);
  return offered ? { slots: [offered, ...slots.filter((slot) => slot !== offered)], offeredId: offered.id } : { slots, offeredId: null };
}
