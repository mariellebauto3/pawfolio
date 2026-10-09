import { PLACE_TYPE_LABELS, slotPlace, slotPlaceKind } from "@/constants/meet-and-greet";
import { philippineTimeToIso } from "@/lib/utils/format-date";
import type { PlaceType } from "@/types/meet-and-greet";
import type { NewSlot } from "../types/meetings";

// The rules of a Meet & Greet slot that the screens need (MG-01, MG-02; docs/api/adoption-and-meet-greet.md). The
// API's Form Request is the authority; these mirror its limits and messages so the dialog answers at once
// (SEC-INPUT-05).

// The words for a slot's place are also read outside this module (the adoption record, AL-06), so they live with
// the shared constants.
export { PLACE_TYPE_LABELS, slotPlace, slotPlaceKind };

export const PLACE_TYPES = Object.keys(PLACE_TYPE_LABELS) as PlaceType[];

export const PLACE_DETAILS_MAX = 255;

/** A slot is added once, or on the same weekday and time for this many weeks in a row. */
export const REPEAT_WEEKS = 4;

/** Slots on one page of the availability list. */
export const SLOTS_PAGE_SIZE = 50;

/** The latest past Meet & Greets the availability page shows. */
export const PAST_MEETINGS_SHOWN = 10;

const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

/** What the Add slot dialog holds while it is filled in. Date and time are typed in Philippine time. */
export type SlotDraft = {
  date: string;
  time: string;
  placeType: PlaceType;
  placeDetails: string;
  repeats: boolean;
};

export type SlotErrors = Partial<Record<"date" | "time" | "place_details", string>>;

/**
 * The slot as it is sent, or the message for each field that stops it: a date and a time still ahead and within
 * 12 months, and where to meet unless it is at the caretaker's.
 */
export function readSlotDraft(draft: SlotDraft, now: Date = new Date()): { slot: NewSlot } | { errors: SlotErrors } {
  const errors: SlotErrors = {};
  if (!draft.date) errors.date = "Choose a date.";
  if (!draft.time) errors.time = "Choose a time.";

  const startsAt = draft.date && draft.time ? philippineTimeToIso(draft.date, draft.time) : null;
  if (draft.date && draft.time) {
    const at = startsAt ? new Date(startsAt).getTime() : Number.NaN;
    if (Number.isNaN(at)) errors.date = "Choose a date and a time.";
    else if (at <= now.getTime()) errors.time = "Choose a time that is still ahead.";
    else if (at >= now.getTime() + YEAR_MS) errors.date = "Choose a date within the next 12 months.";
  }

  const details = draft.placeDetails.trim();
  if (details === "" && draft.placeType !== "caretaker_location") {
    errors.place_details = "Say where to meet, such as the name of the park or the shelter.";
  } else if (details.length > PLACE_DETAILS_MAX) {
    errors.place_details = `Keep the place details to ${PLACE_DETAILS_MAX} characters or fewer.`;
  }

  if (Object.keys(errors).length > 0 || !startsAt) return { errors };
  return {
    slot: {
      starts_at: startsAt,
      place_type: draft.placeType,
      place_details: details === "" ? null : details,
      repeat_weeks: draft.repeats ? REPEAT_WEEKS : 1,
    },
  };
}
