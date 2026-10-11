import { type ApiClient, apiPath } from "@/lib/api/core";
import { isRecord, isText, readPage, unexpected } from "@/lib/api/readers";
import type { ApiResource, Paginated } from "@/types/api";
import type { MeetGreetSlot } from "@/types/meet-and-greet";
import { REQUEST_STATUSES, type RequestStatus } from "@/types/statuses";
import { PAST_MEETINGS_SHOWN, SLOTS_PAGE_SIZE } from "../schemas/slots";
import type { NewSlot, PastMeeting, UpcomingSlot } from "../types/meetings";
import { readSlot } from "./meetings";

// A human's Meet & Greet availability (docs/api/adoption-and-meet-greet.md, MG-01, MG-02, FR11). The lists work
// from Server Components with `getServerApi()`; adding and removing run in the browser. Whose slots they are comes
// from the session, so it is never sent (SEC-AUTHZ-02).

const LIST_PROBLEM = "We couldn't load your Meet & Greet slots. Please try again.";
const ADD_PROBLEM = "We couldn't tell whether the slot was added. Reload the page to check before adding it again.";

const isStatus = (value: unknown): value is RequestStatus => (REQUEST_STATUSES as readonly unknown[]).includes(value);

/** A slot with the pet that booked it. A booking that names no pet or no request can't be shown truthfully, so the row is left out. */
function readUpcoming(value: unknown): UpcomingSlot | null {
  const slot = readSlot(value);
  if (!slot || !isRecord(value)) return null;
  const booking = value.active_booking;
  if (!isRecord(booking)) return { ...slot, booking: null };
  if ((booking.status !== "booked" && booking.status !== "confirmed") || typeof booking.adoption_request_id !== "number" || !isText(booking.pet_name)) {
    return null;
  }
  return { ...slot, booking: { status: booking.status, adoption_request_id: booking.adoption_request_id, pet_name: booking.pet_name } };
}

function readPast(value: unknown): PastMeeting | null {
  if (!isRecord(value) || typeof value.id !== "number" || typeof value.adoption_request_id !== "number") return null;
  const slot = readSlot(value.slot);
  if (!slot || !isText(value.pet_name) || !isStatus(value.request_status)) return null;
  return {
    id: value.id,
    adoption_request_id: value.adoption_request_id,
    pet_name: value.pet_name,
    request_status: value.request_status,
    didnt_happen: isText(value.end_reason) && value.end_reason !== "",
    slot,
  };
}

/** Rows that don't read as what the list holds are left out, as on every list. */
function readRows<T>(response: unknown, read: (value: unknown) => T | null): Paginated<T> {
  const page = readPage(response, isRecord, LIST_PROBLEM);
  return { ...page, data: page.data.map(read).filter((row): row is T => row !== null) };
}

/** The signed-in human's slots that are still ahead, soonest first, open or booked (MG-01). */
export async function getUpcomingSlots(client: ApiClient, page = 1): Promise<Paginated<UpcomingSlot>> {
  const query = { when: "upcoming", page: page > 1 ? page : undefined, per_page: SLOTS_PAGE_SIZE };
  return readRows(await client.get<unknown>("/meet-greet-slots", { query }), readUpcoming);
}

/** The human's latest confirmed meetings whose time has come, newest first (MG-01, "Past Meet & Greets"). */
export async function getPastMeetings(client: ApiClient): Promise<Paginated<PastMeeting>> {
  return readRows(await client.get<unknown>("/meet-greet-slots", { query: { when: "past", per_page: PAST_MEETINGS_SHOWN } }), readPast);
}

/**
 * Adds a slot, or the same slot for the weeks that follow (MG-02). The answer is always the list of what was
 * added. 422 with a message per field: `starts_at` (not ahead, too far ahead, or a slot already at that time),
 * `place_type`, `place_details`.
 */
export async function addSlots(client: ApiClient, slot: NewSlot): Promise<MeetGreetSlot[]> {
  const data = (await client.post<ApiResource<unknown>>("/meet-greet-slots", slot))?.data;
  const added = Array.isArray(data) ? data.map(readSlot).filter((row): row is MeetGreetSlot => row !== null) : [];
  if (added.length === 0) throw unexpected(ADD_PROBLEM);
  return added;
}

/** Removes an open slot (MG-01). 409 `slot_has_active_booking` when a pet has booked it in the meantime. */
export async function removeSlot(client: ApiClient, slotId: number): Promise<void> {
  await client.delete(apiPath`/meet-greet-slots/${slotId}`);
}
