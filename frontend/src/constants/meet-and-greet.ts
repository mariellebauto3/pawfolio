import type { MeetGreetSlot, PlaceType } from "@/types/meet-and-greet";

// How the place of a Meet & Greet is written wherever one is named: on a slot, a meeting, and the adoption record
// (MG-01…MG-08, AL-06). The place a human typed is always rendered as plain text (SEC-FE-01).

/** Where a meeting takes place, in the words of the Add slot dialog (MG-02). */
export const PLACE_TYPE_LABELS = {
  public_spot: "Public spot",
  shelter: "Shelter",
  caretaker_location: "Caretaker’s location",
} as const satisfies Record<PlaceType, string>;

/**
 * Where a slot is, in one line: the place the human named, or the kind of place when there is no name (a meeting
 * at the caretaker's, which the two sides arrange once it is confirmed).
 */
export function slotPlace(slot: Pick<MeetGreetSlot, "place_type" | "place_details">): string {
  return slot.place_details ?? PLACE_TYPE_LABELS[slot.place_type];
}

/** The kind of place, when it says more than the place's own name. */
export function slotPlaceKind(slot: Pick<MeetGreetSlot, "place_type" | "place_details">): string | null {
  return slot.place_details ? PLACE_TYPE_LABELS[slot.place_type] : null;
}
