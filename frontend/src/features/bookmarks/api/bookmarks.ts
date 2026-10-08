import { type ApiClient, apiPath } from "@/lib/api/core";
import { isHome, isPet, isRecord, readPage } from "@/lib/api/readers";
import type { Paginated } from "@/types/api";
import type { BookmarkTarget, SavedHome, SavedPet } from "../types/bookmarks";

// Bookmark calls (docs/api/bookmarks-and-invites.md, BM-01…BM-04, FR8, FR23). The list is a read, so it works from
// Server Components with `getServerApi()`; saving and removing run in the browser. The API decides what may be
// saved: a human saves pets, a pet saves homes, and only profiles the account may open (SEC-FE-05). Every path with
// an id is built with apiPath (SEC-FE-08).

/** Cards on one page of the Bookmarks screen: four rows of three on a desktop. */
export const BOOKMARKS_PAGE_SIZE = 12;

const LIST_PROBLEM = "We couldn't load your bookmarks. Please try again.";

// A row whose profile doesn't match the contract isn't shown: the card reads its lists and its status.
function isSavedPet(row: unknown): row is SavedPet {
  return isRecord(row) && typeof row.id === "number" && isPet(row.pet);
}

function isSavedHome(row: unknown): row is SavedHome {
  return isRecord(row) && typeof row.id === "number" && isHome(row.home_profile);
}

const pageQuery = (page: number) => ({ page: page > 1 ? page : undefined, per_page: BOOKMARKS_PAGE_SIZE });

/** The pets a human saved, newest save first (BM-01). Pets that have since been hidden are left out by the API. */
export async function getSavedPets(client: ApiClient, page = 1): Promise<Paginated<SavedPet>> {
  return readPage(await client.get<unknown>("/bookmarks", { query: pageQuery(page) }), isSavedPet, LIST_PROBLEM);
}

/** The homes a pet saved, newest save first (BM-02). */
export async function getSavedHomes(client: ApiClient, page = 1): Promise<Paginated<SavedHome>> {
  return readPage(await client.get<unknown>("/bookmarks", { query: pageQuery(page) }), isSavedHome, LIST_PROBLEM);
}

/** Saves a profile (BM-03). Saving one that is already saved is not an error. */
export async function saveBookmark(client: ApiClient, target: BookmarkTarget): Promise<void> {
  await client.post<unknown>("/bookmarks", target.kind === "pet" ? { pet_id: target.id } : { home_profile_id: target.id });
}

/** Removes the account's bookmark of a profile. Removing one that isn't there is not an error. */
export async function removeBookmark(client: ApiClient, target: BookmarkTarget): Promise<void> {
  await client.delete(target.kind === "pet" ? apiPath`/bookmarks/pets/${target.id}` : apiPath`/bookmarks/home-profiles/${target.id}`);
}
