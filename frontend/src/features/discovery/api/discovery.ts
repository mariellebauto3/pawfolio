import { type ApiClient, apiPath } from "@/lib/api/core";
import { ApiError } from "@/lib/api/errors";
import type { AdoptionRequest } from "@/types/adoption-request";
import type { ApiResource, Paginated } from "@/types/api";
import type { HomeProfile } from "@/types/home-profile";
import type { Pet } from "@/types/pet";
import { PET_STATUSES, REQUEST_STATUSES } from "@/types/statuses";
import { type BrowseFilters, browseApiQuery } from "../schemas/browse-filters";
import { SEARCH_PAGE_SIZE, SEARCH_PREVIEW, type SearchKind, type SearchTotals } from "../schemas/search";
import {
  DEALBREAKERS,
  type Dealbreaker,
  type HomeListing,
  type HomeProfileDetail,
  type MatchEvaluation,
  POST_TYPES,
  type PetListing,
  type PetProfile,
  type SearchPost,
  type SearchResults,
} from "../types/discovery";

// Discovery calls (docs/api/discovery.md, DS-01…DS-08, FR6, FR7, FR22). All reads, so they work from Server
// Components with `getServerApi()`. The API decides who may see what: a Draft, a suspended account's profile and a
// home that isn't Open to Adopt all answer 404 (SEC-AUTHZ-04). Every path with an id is built with apiPath
// (SEC-FE-08).

const unexpected = (message: string) => new ApiError({ kind: "server", status: 200, message });

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const isText = (value: unknown): value is string => typeof value === "string";

const PET_LISTS = ["photos", "temperament_tags", "skills", "special_needs"] as const;
const HOME_LISTS = ["household_members", "other_pets", "accepted_species", "preferred_sizes", "preferred_ages", "adopted_pets"] as const;

// The screens read every list and choose badges and actions from the status and the two switches, so a row that
// doesn't match the contract isn't shown.
function isPet(value: unknown): value is Pet {
  return (
    isRecord(value) &&
    typeof value.id === "number" &&
    isText(value.name) &&
    (PET_STATUSES as readonly unknown[]).includes(value.status) &&
    PET_LISTS.every((list) => Array.isArray(value[list]))
  );
}

function isHome(value: unknown): value is HomeProfile {
  return (
    isRecord(value) &&
    typeof value.id === "number" &&
    isText(value.full_name) &&
    typeof value.is_open_to_adopt === "boolean" &&
    HOME_LISTS.every((list) => Array.isArray(value[list]))
  );
}

function readPage<T>(response: unknown, isItem: (value: unknown) => value is T, problem: string): Paginated<T> {
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

/** The match as the profile endpoints send it, or nothing when it is missing or malformed. */
function readMatch(value: unknown): MatchEvaluation | undefined {
  if (!isRecord(value) || typeof value.passed_dealbreakers !== "boolean" || typeof value.score !== "number") return undefined;
  const failed = Array.isArray(value.failed_dealbreakers) ? value.failed_dealbreakers : [];
  return {
    passed_dealbreakers: value.passed_dealbreakers,
    failed_dealbreakers: failed.filter((key): key is Dealbreaker => (DEALBREAKERS as readonly unknown[]).includes(key)),
    score: value.score,
    reasons: Array.isArray(value.reasons) ? value.reasons.filter(isText) : [],
  };
}

/** Pets looking for a home, a page at a time (DS-01). Adopted pets and Drafts never come back. */
export async function browsePets(client: ApiClient, filters: BrowseFilters): Promise<Paginated<PetListing>> {
  const response = await client.get<unknown>("/pets", { query: browseApiQuery("pets", filters) });
  return readPage<PetListing>(response, isPet, "We couldn't load the pets. Please try again.");
}

/** Homes that are Open to Adopt, a page at a time, with public details only (DS-02, SEC-PRIV-03). */
export async function browseHomes(client: ApiClient, filters: BrowseFilters): Promise<Paginated<HomeListing>> {
  const response = await client.get<unknown>("/home-profiles", { query: browseApiQuery("homes", filters) });
  return readPage<HomeListing>(response, isHome, "We couldn't load the homes. Please try again.");
}

/** A pet's resume as someone else reads it (DS-05, DS-08). 404 for a Draft or a pet whose account isn't Active. */
export async function getPetProfile(client: ApiClient, petId: number): Promise<PetProfile> {
  const data = (await client.get<ApiResource<unknown>>(apiPath`/pets/${petId}`))?.data;
  if (!isPet(data)) throw unexpected("We couldn't load this resume. Please try again.");
  return { ...data, match: readMatch((data as Record<string, unknown>).match) };
}

/** A Home Profile as someone else reads it (DS-07). 404 when it isn't Open to Adopt and the viewer has no request or invite with it. */
export async function getHomeProfileDetail(client: ApiClient, homeProfileId: number): Promise<HomeProfileDetail> {
  const data = (await client.get<ApiResource<unknown>>(apiPath`/home-profiles/${homeProfileId}`))?.data;
  if (!isHome(data)) throw unexpected("We couldn't load this Home Profile. Please try again.");
  return { ...data, match: readMatch((data as Record<string, unknown>).match) };
}

function isSearchPost(value: unknown): value is SearchPost {
  return isRecord(value) && typeof value.id === "number" && (POST_TYPES as readonly unknown[]).includes(value.type);
}

const SEARCH_PROBLEM = "We couldn't run that search. Please try again.";

/** The API's name for each kind of result. */
const SEARCH_TYPES = { pets: "pets", homes: "home_profiles", posts: "posts" } as const satisfies Record<SearchKind, string>;

function readTotals(value: unknown): SearchTotals {
  const count = (key: string) => (isRecord(value) && typeof value[key] === "number" ? (value[key] as number) : 0);
  return { pets: count(SEARCH_TYPES.pets), homes: count(SEARCH_TYPES.homes), posts: count(SEARCH_TYPES.posts) };
}

/**
 * Pets, homes and posts that mention the words (DS-03). Without a `kind`: the first few of each. With one: that
 * kind, a page at a time. Either way the answer says how many there are of every kind, for the tabs.
 */
export async function search(client: ApiClient, words: string, kind: SearchKind | null = null, page = 1): Promise<SearchResults> {
  if (!kind) {
    const data = (await client.get<ApiResource<unknown>>("/search", { query: { q: words, limit: SEARCH_PREVIEW } }))?.data;
    if (!isRecord(data)) throw unexpected(SEARCH_PROBLEM);
    const list = (value: unknown) => (Array.isArray(value) ? value : []);
    return {
      query: isText(data.query) ? data.query : words,
      totals: readTotals(data.totals),
      view: { kind: "all", pets: list(data.pets).filter(isPet), homes: list(data.home_profiles).filter(isHome), posts: list(data.posts).filter(isSearchPost) },
    };
  }

  const response = await client.get<unknown>("/search", {
    query: { q: words, type: SEARCH_TYPES[kind], page: page > 1 ? page : undefined, per_page: SEARCH_PAGE_SIZE },
  });
  const meta = isRecord(response) && isRecord(response.meta) ? response.meta : {};
  const found = { query: isText(meta.query) ? meta.query : words, totals: readTotals(meta.totals) };
  if (kind === "pets") return { ...found, view: { kind, page: readPage(response, isPet, SEARCH_PROBLEM) } };
  if (kind === "homes") return { ...found, view: { kind, page: readPage(response, isHome, SEARCH_PROBLEM) } };
  return { ...found, view: { kind, page: readPage(response, isSearchPost, SEARCH_PROBLEM) } };
}

/** A few other pets of the same species that are looking for a home, for the side of a resume (DS-05). */
export async function getSimilarPets(client: ApiClient, pet: Pick<Pet, "id" | "species">, limit = 3): Promise<Pet[]> {
  const response = await client.get<unknown>("/pets", { query: { species: pet.species, sort: "newest", per_page: limit + 1 } });
  const pets = isRecord(response) && Array.isArray(response.data) ? response.data.filter(isPet) : [];
  return pets.filter((other) => other.id !== pet.id).slice(0, limit);
}

/**
 * The signed-in pet's latest requests, newest first, for `applyStateFor` (DS-07). What decides the button is recent
 * by nature: a pet has at most three open requests, and a cooldown lasts 30 days, so the newest page holds them.
 */
export async function getOwnRequests(client: ApiClient): Promise<AdoptionRequest[]> {
  const response = await client.get<unknown>("/adoption-requests", { query: { per_page: 50 } });
  const rows = isRecord(response) && Array.isArray(response.data) ? response.data : [];
  return rows.filter(
    (row): row is AdoptionRequest =>
      isRecord(row) && typeof row.id === "number" && (REQUEST_STATUSES as readonly unknown[]).includes(row.status) && isRecord(row.home_profile),
  );
}
