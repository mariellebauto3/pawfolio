import { type ApiClient, apiPath } from "@/lib/api/core";
import { isRecord, isText, readPage, readResolution, unexpected } from "@/lib/api/readers";
import { RESOLUTION_ACTIONS, type Resolution, type ResolutionAction } from "@/types/adoption-resolution";
import type { ApiResource, Paginated } from "@/types/api";
import { PET_STATUSES, type PetStatus, REQUEST_STATUSES, type RequestStatus } from "@/types/statuses";
import type { PetMatch, ResolutionChange, ResolutionInput, ResolveActionOption, ResolveOptions, ResolveRequest } from "../types/resolutions";

// Resolve adoption issue (docs/api/adoption-and-meet-greet.md, "Resolve adoption issue", AL-07, AL-08, FR37): the
// only manual change to a pet's or a request's status. What a pet offers and the recent resolutions are read from
// Server Components with `getServerApi()`; the preview and the change itself run in the browser, where the CSRF
// token is. Only an action, the request it is about and the reason are sent: never a status, and never who is
// acting, which is the session's (FR27, SEC-AUTHZ-02). The API checks the admin role, requires the reason and logs
// the change (SEC-AUTHZ-07, SEC-LOG-01). Every path with an id is built with apiPath (SEC-FE-08).

const OPTIONS_PROBLEM = "We couldn't load this pet. Please try again.";
const PREVIEW_PROBLEM = "We couldn't work out what this would change. Please try again.";
const APPLY_PROBLEM = "We couldn't confirm that the change was applied. Reload the page to see where the pet stands before trying again.";
const LIST_PROBLEM = "We couldn't load the recent resolutions. Please try again.";
const SEARCH_PROBLEM = "We couldn't search the pets. Please try again.";

const isId = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value > 0;
const textOrNull = (value: unknown) => (isText(value) && value.trim() !== "" ? value : null);
const dateOrNull = (value: unknown) => (isText(value) && !Number.isNaN(new Date(value).getTime()) ? value : null);
const isPetStatus = (value: unknown): value is PetStatus => (PET_STATUSES as readonly unknown[]).includes(value);
const isRequestStatus = (value: unknown): value is RequestStatus => (REQUEST_STATUSES as readonly unknown[]).includes(value);
const isAction = (value: unknown): value is ResolutionAction => (RESOLUTION_ACTIONS as readonly unknown[]).includes(value);

function readRequest(row: unknown): ResolveRequest | null {
  if (!isRecord(row) || !isId(row.id) || !isRequestStatus(row.status)) return null;
  return { id: row.id, status: row.status, home_name: textOrNull(row.home_name), sent_at: dateOrNull(row.sent_at), closed_at: dateOrNull(row.closed_at) };
}

/**
 * What a pet offers, read strictly: an action is offered only on a plain `true`, and only for requests that are
 * on the pet's own list, so nothing is offered that the answer didn't spell out (SEC-FE-05).
 */
function readOptions(data: unknown): ResolveOptions {
  if (!isRecord(data) || !isRecord(data.pet) || !isId(data.pet.id) || !isText(data.pet.name) || !isPetStatus(data.pet.status)) throw unexpected(OPTIONS_PROBLEM);
  const { pet } = data;
  const requests = Array.isArray(data.requests) ? data.requests.flatMap((row) => readRequest(row) ?? []) : [];
  const known = new Set(requests.map((request) => request.id));
  const answered = Array.isArray(data.actions) ? data.actions.filter(isRecord) : [];

  const actions: ResolveActionOption[] = RESOLUTION_ACTIONS.map((action) => {
    const row = answered.find((candidate) => candidate.action === action);
    return {
      action,
      available: row?.available === true,
      request_ids: Array.isArray(row?.request_ids) ? row.request_ids.filter((id): id is number => isId(id) && known.has(id)) : [],
      unavailable_reason: textOrNull(row?.unavailable_reason),
    };
  });

  const furparent = isRecord(data.furparent) && isId(data.furparent.home_profile_id) ? data.furparent : null;
  return {
    pet: { id: pet.id as number, name: pet.name as string, status: pet.status as PetStatus, city: textOrNull(pet.city), photo_url: textOrNull(pet.photo_url), user_id: isId(pet.user_id) ? pet.user_id : null },
    furparent: furparent && {
      home_profile_id: furparent.home_profile_id as number,
      full_name: textOrNull(furparent.full_name),
      adopted_at: dateOrNull(furparent.adopted_at),
      adoption_request_id: isId(furparent.adoption_request_id) ? furparent.adoption_request_id : null,
    },
    requests,
    actions,
  };
}

function readStanding(value: unknown) {
  if (!isRecord(value) || !isPetStatus(value.pet_status)) return null;
  return { pet_status: value.pet_status, request_status: isRequestStatus(value.request_status) ? value.request_status : null, furparent_name: textOrNull(value.furparent_name) };
}

/** A change, or null when the answer isn't one: the dialog shows statuses, so it never shows a guess. */
export function readChange(data: unknown): ResolutionChange | null {
  if (!isRecord(data) || !isText(data.pet_name) || !isAction(data.action)) return null;
  const before = readStanding(data.before);
  const after = readStanding(data.after);
  if (!before || !after) return null;
  const request = isRecord(data.request) && isId(data.request.id) ? { id: data.request.id, home_name: textOrNull(data.request.home_name) } : null;
  return {
    pet_name: data.pet_name,
    action: data.action,
    request,
    before,
    after,
    requests_restored: typeof data.requests_restored === "number" && data.requests_restored > 0 ? Math.floor(data.requests_restored) : 0,
    meeting_ended: data.meeting_ended === true,
  };
}

const body = (input: ResolutionInput) => ({ action: input.action, adoption_request_id: input.requestId ?? undefined });

/** The pet, its Furparent link, its requests, and which of the four actions each offers now (AL-07). 404 when there is no such pet. */
export async function getResolveOptions(client: ApiClient, petId: number): Promise<ResolveOptions> {
  return readOptions((await client.get<ApiResource<unknown>>(apiPath`/admin/adoptions/${petId}/resolve`))?.data);
}

/**
 * What an action would change, before anything is written (AL-08). Throws ApiError 409 with a message to show when
 * it no longer applies to the pet or the request (`resolution_not_available`, `resolution_request_required`).
 */
export async function previewResolution(client: ApiClient, petId: number, input: ResolutionInput): Promise<ResolutionChange> {
  const change = readChange((await client.post<ApiResource<unknown>>(apiPath`/admin/adoptions/${petId}/resolve/preview`, body(input)))?.data);
  if (!change) throw unexpected(PREVIEW_PROBLEM);
  return change;
}

/**
 * Applies the action with its required reason (FR37). Both accounts are told, and the change is written to the
 * activity log with the admin's name. Throws ApiError: 422 `fieldErrors.reason`; 409 with a message to show when
 * another admin got there first or the request moved on.
 */
export async function applyResolution(client: ApiClient, petId: number, input: ResolutionInput & { reason: string }): Promise<Resolution> {
  const data = (await client.post<ApiResource<unknown>>(apiPath`/admin/adoptions/${petId}/resolve`, { ...body(input), reason: input.reason.trim() }))?.data;
  const resolution = readResolution(data);
  if (!resolution) throw unexpected(APPLY_PROBLEM);
  return resolution;
}

/** The latest resolutions on the platform, newest first (AL-07 "Recent resolutions"). */
export async function getRecentResolutions(client: ApiClient, perPage = 8): Promise<Paginated<Resolution>> {
  const response = await client.get<unknown>("/admin/adoption-resolutions", { query: { per_page: perPage } });
  if (!isRecord(response) || !Array.isArray(response.data)) throw unexpected(LIST_PROBLEM);
  return readPage({ ...response, data: response.data.map(readResolution) }, (row): row is Resolution => row !== null, LIST_PROBLEM);
}

/**
 * Pets whose name, or whose account's name or email, matches, to pick the one an issue is about. Read from the
 * accounts list (AC-06), which is where an admin's search of accounts lives; only the pet's public summary is kept.
 */
export async function findPets(client: ApiClient, search: string, perPage = 8): Promise<{ pets: PetMatch[]; total: number }> {
  const response = await client.get<unknown>("/admin/accounts", { query: { tab: "pet", q: search, per_page: perPage } });
  if (!isRecord(response) || !Array.isArray(response.data)) throw unexpected(SEARCH_PROBLEM);
  const pets = response.data.flatMap((row): PetMatch[] => {
    const pet = isRecord(row) && isRecord(row.pet) ? row.pet : null;
    if (!pet || !isRecord(row) || !isId(pet.id) || !isText(pet.name)) return [];
    return [{ id: pet.id, name: pet.name, status: isPetStatus(pet.status) ? pet.status : null, city: textOrNull(pet.city), photo_url: textOrNull(pet.photo_url), caretaker_name: textOrNull(row.caretaker_name) }];
  });
  const total = isRecord(response.meta) && typeof response.meta.total === "number" ? response.meta.total : pets.length;
  return { pets, total };
}
