import { type ApiClient, apiPath } from "@/lib/api/core";
import { ApiError } from "@/lib/api/errors";
import type { ApiResource, Paginated } from "@/types/api";
import type { Pet, Species } from "@/types/pet";
import { PET_STATUSES } from "@/types/statuses";
import type { ActivityPost, OwnPet } from "../types/own-pet";

// The pet's own resume (docs/api/profiles-and-matching.md, PR-01…PR-10, FR20). The read works from Server Components
// with `getServerApi()`; the writes run in the browser, where the CSRF token is. Every write answers with the whole
// resume, so the screen replaces what it holds with the answer. The status never travels the other way: only
// `publishResume` changes it, on the server (FR27).

const OWN_PET = "/me/pet";

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

function readOwnPet(response: ApiResource<unknown> | null | undefined, problem: string): OwnPet {
  const data = response?.data;
  // The screens choose their actions from `status` and `completeness`, so an answer that doesn't match the contract
  // isn't trusted.
  if (
    !isRecord(data) ||
    typeof data.id !== "number" ||
    !(PET_STATUSES as readonly unknown[]).includes(data.status) ||
    !Array.isArray(data.photos) ||
    !Array.isArray(data.vet_records) ||
    !isRecord(data.completeness) ||
    !isRecord(data.completeness.steps)
  ) {
    throw new ApiError({ kind: "server", status: 200, message: problem });
  }
  return data as OwnPet;
}

const SAVE_PROBLEM = "We couldn't confirm that was saved. Reload the page to see your resume as it stands.";

/** The pet's own resume. 403 for a human or an admin, 404 when the account has no pet. */
export async function getOwnPet(client: ApiClient): Promise<OwnPet> {
  return readOwnPet(await client.get<ApiResource<unknown>>(OWN_PET), "We couldn't load your resume. Please try again.");
}

/** Saves editable fields; build the body with `resumeStepPayload`. Throws ApiError: 422 `fieldErrors` by field. */
export async function updateResume(client: ApiClient, fields: Record<string, unknown>): Promise<OwnPet> {
  return readOwnPet(await client.patch<ApiResource<unknown>>(OWN_PET, fields), SAVE_PROBLEM);
}

export type NewPhoto = { file: File; caption: string; asProfilePhoto: boolean };

/** Adds a gallery photo (PR-09). Throws ApiError: 422 `fieldErrors.photo`, 413 for a file the server won't take. */
export async function addPhoto(client: ApiClient, { file, caption, asProfilePhoto }: NewPhoto): Promise<OwnPet> {
  const form = new FormData();
  form.set("photo", file);
  if (caption.trim()) form.set("caption", caption.trim());
  form.set("is_primary", asProfilePhoto ? "1" : "0");
  return readOwnPet(await client.post<ApiResource<unknown>>(`${OWN_PET}/photos`, form), SAVE_PROBLEM);
}

/** Puts the photos in a new order; the first is the profile photo (PR-04). */
export async function reorderPhotos(client: ApiClient, photoIds: number[]): Promise<OwnPet> {
  return readOwnPet(await client.patch<ApiResource<unknown>>(`${OWN_PET}/photos/order`, { photo_ids: photoIds }), SAVE_PROBLEM);
}

/** Removes a photo. Throws ApiError: 409 when the resume would be left with too few. */
export async function deletePhoto(client: ApiClient, photoId: number): Promise<OwnPet> {
  return readOwnPet(await client.delete<ApiResource<unknown>>(apiPath`/me/pet/photos/${photoId}`), SAVE_PROBLEM);
}

export async function setCoverPhoto(client: ApiClient, file: File): Promise<OwnPet> {
  const form = new FormData();
  form.set("cover_photo", file);
  return readOwnPet(await client.post<ApiResource<unknown>>(`${OWN_PET}/cover-photo`, form), SAVE_PROBLEM);
}

/** Adds a private vet record (PR-07). Throws ApiError: 422 `fieldErrors.vet_record`. */
export async function addVetRecord(client: ApiClient, file: File): Promise<OwnPet> {
  const form = new FormData();
  form.set("vet_record", file);
  return readOwnPet(await client.post<ApiResource<unknown>>(`${OWN_PET}/vet-records`, form), SAVE_PROBLEM);
}

export async function deleteVetRecord(client: ApiClient, recordId: number): Promise<OwnPet> {
  return readOwnPet(await client.delete<ApiResource<unknown>>(apiPath`/me/pet/vet-records/${recordId}`), SAVE_PROBLEM);
}

/**
 * Publishes a complete Draft: the API moves it to Looking for a Home and adds the For Hire post (PR-10). Throws
 * ApiError: 422 when something is still missing, 409 for an adopted pet.
 */
export async function publishResume(client: ApiClient): Promise<OwnPet> {
  return readOwnPet(await client.post<ApiResource<unknown>>(`${OWN_PET}/publish`), SAVE_PROBLEM);
}

/** A few published pets of the same species, for the Similar pets card (PR-01). */
export async function getSimilarPets(client: ApiClient, pet: Pick<Pet, "id" | "species">, limit = 3): Promise<Pet[]> {
  const response = await client.get<Paginated<Pet>>("/pets", { query: { species: pet.species satisfies Species, per_page: limit + 1 } });
  const pets = Array.isArray(response?.data) ? response.data : [];
  return pets.filter((other) => isRecord(other) && other.id !== pet.id).slice(0, limit);
}

/** The pet's latest posts, for the Latest activity card (PR-01). */
export async function getLatestPosts(client: ApiClient, accountId: number, limit = 3): Promise<ActivityPost[]> {
  const response = await client.get<Paginated<unknown>>("/feed", { query: { author_user_id: accountId, per_page: limit } });
  const posts = Array.isArray(response?.data) ? response.data : [];
  return posts.flatMap((post) => {
    if (!isRecord(post) || typeof post.id !== "number" || typeof post.created_at !== "string") return [];
    const text = [post.body, post.title].find((part): part is string => typeof part === "string" && part.trim() !== "");
    return text ? [{ id: post.id, text, created_at: post.created_at }] : [];
  });
}
