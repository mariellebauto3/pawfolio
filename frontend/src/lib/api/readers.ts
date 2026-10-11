import { ApiError } from "@/lib/api/errors";
import { RESOLUTION_ACTIONS, type Resolution, type ResolutionAction } from "@/types/adoption-resolution";
import type { Paginated } from "@/types/api";
import type { HomeProfile } from "@/types/home-profile";
import type { Pet } from "@/types/pet";
import { PET_STATUSES } from "@/types/statuses";

// Checks on what the API answered, shared by the modules that list pets and homes (Discovery, Matching). The
// screens read every list of a profile and choose badges and actions from its status and switches, so an answer
// that doesn't match the contract isn't shown: a row is left out, a page is refused.

export const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

export const isText = (value: unknown): value is string => typeof value === "string";

/** A 2xx answer that isn't what the contract says, shown to the user as `message`. */
export const unexpected = (message: string) => new ApiError({ kind: "server", status: 200, message });

const PET_LISTS = ["photos", "temperament_tags", "skills", "special_needs"] as const;
const HOME_LISTS = ["household_members", "other_pets", "accepted_species", "preferred_sizes", "preferred_ages", "adopted_pets"] as const;

export function isPet(value: unknown): value is Pet {
  return (
    isRecord(value) &&
    typeof value.id === "number" &&
    isText(value.name) &&
    (PET_STATUSES as readonly unknown[]).includes(value.status) &&
    PET_LISTS.every((list) => Array.isArray(value[list]))
  );
}

export function isHome(value: unknown): value is HomeProfile {
  return (
    isRecord(value) &&
    typeof value.id === "number" &&
    isText(value.full_name) &&
    typeof value.is_open_to_adopt === "boolean" &&
    HOME_LISTS.every((list) => Array.isArray(value[list]))
  );
}

/**
 * An admin's resolution, or null when it isn't one. Read by the request an admin monitors (its timeline) and by
 * Resolve adoption issue (its recent resolutions), so it lives here.
 */
export function readResolution(value: unknown): Resolution | null {
  if (!isRecord(value) || typeof value.id !== "number" || !(RESOLUTION_ACTIONS as readonly unknown[]).includes(value.action)) return null;
  if (!isText(value.created_at) || Number.isNaN(new Date(value.created_at).getTime())) return null;
  const pet = isRecord(value.pet) && typeof value.pet.id === "number" && isText(value.pet.name) ? { id: value.pet.id, name: value.pet.name } : null;
  const text = (field: unknown) => (isText(field) && field.trim() !== "" ? field : null);
  return {
    id: value.id,
    action: value.action as ResolutionAction,
    reason: isText(value.reason) ? value.reason : "",
    pet,
    adoption_request_id: typeof value.adoption_request_id === "number" ? value.adoption_request_id : null,
    home_name: text(value.home_name),
    admin_name: text(value.admin_name),
    created_at: value.created_at,
  };
}

/** A paginated list in the shape of every list, keeping the rows that pass `isItem`. Throws `problem` when it isn't a page. */
export function readPage<T>(response: unknown, isItem: (value: unknown) => value is T, problem: string): Paginated<T> {
  if (
    !isRecord(response) ||
    !Array.isArray(response.data) ||
    !isRecord(response.meta) ||
    typeof response.meta.total !== "number" ||
    typeof response.meta.current_page !== "number" ||
    typeof response.meta.last_page !== "number"
  ) {
    throw unexpected(problem);
  }
  return { ...(response as Paginated<T>), data: response.data.filter(isItem) };
}
