import { type ApiClient, apiPath } from "@/lib/api/core";
import { isRecord, isText, unexpected } from "@/lib/api/readers";
import type { ApiResource } from "@/types/api";
import type { CancelReason, MeetAndGreet, MeetContacts, MeetEndReason, MeetGreetSlot, PlaceType } from "@/types/meet-and-greet";
import type { RequestMeeting } from "../types/meetings";

// The Meet & Greet calls of an approved request (docs/api/adoption-and-meet-greet.md, MG-03…MG-10, FR11, FR26):
// the pet books a slot, the human confirms or proposes another time, either side reschedules or cancels. They run
// in the browser. Whose request it is comes from the session and every status is the system's, so neither is ever
// sent (SEC-AUTHZ-02, FR27). Every path with an id is built with apiPath (SEC-FE-08). What a call answers is only
// checked here, never kept: the page is read again from the API, and the contact details a confirmed meeting opens
// are never put in browser storage or a URL (SEC-FE-04).

const CHANGE_PROBLEM = "We couldn't tell whether that went through. Reload the page to see where the Meet & Greet stands.";

const PLACE_TYPES: readonly unknown[] = ["public_spot", "shelter", "caretaker_location"] satisfies PlaceType[];
const END_REASONS: readonly unknown[] = [
  "schedule_conflict",
  "pet_unwell",
  "weather_or_travel",
  "other",
  "didnt_show_pet_side",
  "didnt_show_human_side",
  "moved_to_another_day",
] satisfies MeetEndReason[];

const textOrNull = (value: unknown) => (isText(value) && value !== "" ? value : null);
const isDate = (value: unknown): value is string => isText(value) && !Number.isNaN(new Date(value).getTime());

/** A slot as the screens read it, or null when it isn't one: a slot with no time or no kind of place can't be offered. */
export function readSlot(value: unknown): MeetGreetSlot | null {
  if (!isRecord(value) || typeof value.id !== "number" || !isDate(value.starts_at) || !PLACE_TYPES.includes(value.place_type)) return null;
  return {
    id: value.id,
    home_profile_id: typeof value.home_profile_id === "number" ? value.home_profile_id : 0,
    starts_at: value.starts_at,
    place_type: value.place_type as PlaceType,
    place_details: textOrNull(value.place_details),
  };
}

/** A booking, or null when it isn't one. Its status chooses every button, so anything else is "no booking". */
function readBooking(value: unknown): MeetAndGreet | null {
  if (!isRecord(value) || typeof value.id !== "number") return null;
  if (value.status !== "booked" && value.status !== "confirmed" && value.status !== "ended") return null;
  return {
    id: value.id,
    status: value.status,
    booked_at: textOrNull(value.booked_at),
    confirmed_at: textOrNull(value.confirmed_at),
    ended_at: textOrNull(value.ended_at),
    ended_by: value.ended_by === "pet" || value.ended_by === "human" ? value.ended_by : null,
    end_reason: END_REASONS.includes(value.end_reason) ? (value.end_reason as MeetEndReason) : null,
    end_details: textOrNull(value.end_details),
    slot: readSlot(value.slot),
    proposed_slot: readSlot(value.proposed_slot),
  };
}

/** The contact details, only when the API says a confirmed meeting has opened them (SEC-PRIV-02). */
function readContacts(data: Record<string, unknown>): MeetContacts | null {
  const contacts = data.contacts;
  if (data.contact_unlocked !== true || !isRecord(contacts)) return null;
  return {
    caretaker_name: textOrNull(contacts.caretaker_name),
    caretaker_contact_number: textOrNull(contacts.caretaker_contact_number),
    human_full_name: textOrNull(contacts.human_full_name),
    human_contact_number: textOrNull(contacts.human_contact_number),
    human_street_address: textOrNull(contacts.human_street_address),
    human_city: textOrNull(contacts.human_city),
    human_province: textOrNull(contacts.human_province),
  };
}

/**
 * The Meet & Greet part of a request, from the `data` of `GET /adoption-requests/{id}`. A booking without its slot
 * can't be shown or acted on, so it is read as no booking. Passed to `getRequest` by the request's page, so the
 * request and its Meet & Greet come from one call.
 */
export function readRequestMeeting(data: Record<string, unknown>): RequestMeeting {
  const active = readBooking(data.active_meet_and_greet);
  const slots = Array.isArray(data.available_slots) ? data.available_slots.map(readSlot).filter((slot): slot is MeetGreetSlot => slot !== null) : [];
  return {
    active: active && active.status !== "ended" && active.slot ? active : null,
    latest: readBooking(data.latest_meet_and_greet),
    slots,
    contacts: readContacts(data),
  };
}

/** The Meet & Greet after a change. An answer that isn't a request is not a change we can vouch for. */
function readChanged(response: ApiResource<unknown> | null | undefined): RequestMeeting {
  const data = response?.data;
  if (!isRecord(data) || typeof data.id !== "number" || !isText(data.status)) throw unexpected(CHANGE_PROBLEM);
  return readRequestMeeting(data);
}

const meetPath = (requestId: number) => apiPath`/adoption-requests/${requestId}/meet-and-greet`;

/**
 * Books one of the home's open slots on an Approved request (MG-03, FR26); the human then confirms it. 409 with a
 * message to show: `slot_unavailable` or `slot_already_booked` (pick another), `invalid_request_state` (no longer
 * Approved).
 */
export async function bookSlot(client: ApiClient, requestId: number, slotId: number): Promise<RequestMeeting> {
  const meeting = readChanged(await client.post<ApiResource<unknown>>(meetPath(requestId), { slot_id: slotId }));
  if (meeting.active?.status !== "booked") throw unexpected(CHANGE_PROBLEM);
  return meeting;
}

/**
 * Confirms the pet's booking (MG-05, FR11): the request becomes Meet Scheduled and each side's contact details open
 * to the other. 409 `no_pending_booking` (the pet changed or cancelled it) or `slot_passed`.
 */
export async function confirmBooking(client: ApiClient, requestId: number): Promise<RequestMeeting> {
  const meeting = readChanged(await client.post<ApiResource<unknown>>(apiPath`/adoption-requests/${requestId}/meet-and-greet/confirm`));
  if (meeting.active?.status !== "confirmed") throw unexpected(CHANGE_PROBLEM);
  return meeting;
}

/**
 * Offers the pet another of the human's open slots in place of the booking (MG-06, FR11), with an optional
 * message. The booking ends and the pet books again. 409 when the slot can't be offered any more, or
 * `no_active_booking`.
 */
export async function proposeTime(client: ApiClient, requestId: number, offer: { slotId: number; message: string | null }): Promise<RequestMeeting> {
  const body = { proposed_slot_id: offer.slotId, message: offer.message };
  return readChanged(await client.post<ApiResource<unknown>>(apiPath`/adoption-requests/${requestId}/meet-and-greet/propose-time`, body));
}

/**
 * Moves the pet's booking to another open slot (MG-04, MG-09, FR26), with an optional reason. The human confirms
 * the new time, so a confirmed meeting is Approved again until then. 409 when the slot can't be taken, or
 * `no_active_booking`.
 */
export async function rescheduleMeeting(client: ApiClient, requestId: number, change: { slotId: number; reason: string | null }): Promise<RequestMeeting> {
  const body = { slot_id: change.slotId, reason: change.reason };
  const meeting = readChanged(await client.post<ApiResource<unknown>>(apiPath`/adoption-requests/${requestId}/meet-and-greet/reschedule`, body));
  if (meeting.active?.status !== "booked") throw unexpected(CHANGE_PROBLEM);
  return meeting;
}

/**
 * Calls the Meet & Greet off (MG-10), from either side, with a required reason and optional details. Booking
 * reopens and the contact details close. 409 `no_active_booking` when there is nothing left to cancel.
 */
export async function cancelMeeting(client: ApiClient, requestId: number, why: { reason: CancelReason; details: string | null }): Promise<RequestMeeting> {
  const meeting = readChanged(await client.post<ApiResource<unknown>>(apiPath`/adoption-requests/${requestId}/meet-and-greet/cancel`, why));
  if (meeting.active !== null) throw unexpected(CHANGE_PROBLEM);
  return meeting;
}
