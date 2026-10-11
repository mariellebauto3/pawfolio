import { type ApiClient, apiPath } from "@/lib/api/core";
import { isRecord, isText, unexpected } from "@/lib/api/readers";
import type { ApiResource } from "@/types/api";
import type { PlaceType } from "@/types/meet-and-greet";
import type { AdoptionRecord, RequestAdoption } from "../types/adoptions";

// The adoption calls (docs/api/adoption-and-meet-greet.md, AL-01…AL-06, FR12, FR13, FR14, FR28): the human adopts
// once the Meet & Greet time has passed, and the two sides read the adoption record afterwards. Whose request it is
// comes from the session and every status is the system's, so neither is ever sent (SEC-AUTHZ-02, FR27). Every path
// with an id is built with apiPath (SEC-FE-08).

const ADOPT_PROBLEM = "We couldn't tell whether the adoption went through. Reload the page to see where the request stands.";
const RECORD_PROBLEM = "We couldn't load the adoption details. Please try again.";

const PLACE_TYPES: readonly unknown[] = ["public_spot", "shelter", "caretaker_location"] satisfies PlaceType[];

const textOrNull = (value: unknown) => (isText(value) && value !== "" ? value : null);
const dateOrNull = (value: unknown) => (isText(value) && !Number.isNaN(new Date(value).getTime()) ? value : null);

/**
 * The adoption a request ended in, from the `data` of `GET /adoption-requests/{id}`; null for every request that
 * isn't Adopted. Handed to the request's page beside the Meet & Greet reader, so one call answers both.
 */
export function readRequestAdoption(data: Record<string, unknown>): RequestAdoption | null {
  const adoption = data.adoption;
  if (data.status !== "adopted" || !isRecord(adoption) || typeof adoption.id !== "number") return null;
  return { id: adoption.id, adopted_at: dateOrNull(adoption.adopted_at) };
}

/**
 * Adopts the pet of a request whose Meet & Greet time has passed (AL-01, FR12). The request becomes Adopted, the pet
 * Adopted — Hired and linked to the human for good, the human a Furparent, and the pet's other open requests
 * close. 409 with a message to show: `meeting_not_yet_passed`, `invalid_request_state` (decided or withdrawn in the
 * meantime), `already_adopted`.
 */
export async function adoptPet(client: ApiClient, requestId: number): Promise<RequestAdoption> {
  const data = (await client.post<ApiResource<unknown>>(apiPath`/adoption-requests/${requestId}/adopt`))?.data;
  const adoption = isRecord(data) ? readRequestAdoption(data) : null;
  // Anything but an Adopted request with its adoption is not an adoption we can vouch for.
  if (!adoption) throw unexpected(ADOPT_PROBLEM);
  return adoption;
}

function readMeeting(value: unknown): AdoptionRecord["meeting"] {
  if (!isRecord(value) || dateOrNull(value.starts_at) === null || !PLACE_TYPES.includes(value.place_type)) return null;
  return { starts_at: value.starts_at as string, place_type: value.place_type as PlaceType, place_details: textOrNull(value.place_details) };
}

/**
 * One adoption record (AL-06). 404 for an adoption that isn't the caller's, like one that doesn't exist
 * (SEC-AUTHZ-04). The pet's and the human's names choose the whole dialog, so an answer without them is refused.
 */
export async function getAdoption(client: ApiClient, adoptionId: number, signal?: AbortSignal): Promise<AdoptionRecord> {
  const data = (await client.get<ApiResource<unknown>>(apiPath`/adoptions/${adoptionId}`, { signal }))?.data;
  if (!isRecord(data) || typeof data.id !== "number" || typeof data.adoption_request_id !== "number") throw unexpected(RECORD_PROBLEM);
  const { pet, home_profile: home } = data;
  if (!isRecord(pet) || typeof pet.id !== "number" || !isText(pet.name)) throw unexpected(RECORD_PROBLEM);
  if (!isRecord(home) || typeof home.id !== "number" || !isText(home.full_name)) throw unexpected(RECORD_PROBLEM);

  const timeline = isRecord(data.timeline) ? data.timeline : {};
  const days = data.days_to_adoption;

  return {
    id: data.id,
    pet: { ...(pet as AdoptionRecord["pet"]), photo_url: textOrNull(pet.photo_url) },
    home_profile: {
      id: home.id,
      full_name: home.full_name,
      city: isText(home.city) ? home.city : "",
      profile_photo_url: textOrNull(home.profile_photo_url),
      is_furparent: home.is_furparent === true,
    },
    adoption_request_id: data.adoption_request_id,
    adopted_at: dateOrNull(data.adopted_at),
    days_to_adoption: typeof days === "number" && Number.isInteger(days) && days >= 1 ? days : null,
    cover_letter: textOrNull(data.cover_letter),
    timeline: {
      sent_at: dateOrNull(timeline.sent_at),
      approved_at: dateOrNull(timeline.approved_at),
      meet_scheduled_at: dateOrNull(timeline.meet_scheduled_at),
    },
    meeting: readMeeting(data.meeting),
  };
}
