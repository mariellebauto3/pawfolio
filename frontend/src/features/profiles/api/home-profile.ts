import { type ApiClient, apiPath } from "@/lib/api/core";
import { ApiError } from "@/lib/api/errors";
import type { ApiResource, Paginated } from "@/types/api";
import type { OwnHomeProfile } from "../types/own-home-profile";

// The human's own Home Profile (docs/api/profiles-and-matching.md, PR-11…PR-20, FR3, FR4). The read works from
// Server Components with `getServerApi()`; the writes run in the browser, where the CSRF token is. Every write
// answers with the whole Home Profile, so the screen replaces what it holds with the answer. The home comes from
// the session, never from an id in the request (SEC-AUTHZ-02).

const OWN_HOME = "/me/home-profile";

/** 409 `code` when Open to Adopt is turned on before the quiz is finished. */
export const QUIZ_INCOMPLETE_CODE = "quiz_incomplete";

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const LISTS = ["household_members", "other_pets", "accepted_species", "preferred_sizes", "preferred_ages", "adopted_pets"] as const;

function readOwnHome(response: ApiResource<unknown> | null | undefined, problem: string): OwnHomeProfile {
  const data = response?.data;
  // The screens choose their actions from the two switches and read every list, so an answer that doesn't match the
  // contract isn't trusted.
  if (
    !isRecord(data) ||
    typeof data.id !== "number" ||
    typeof data.full_name !== "string" ||
    typeof data.is_open_to_adopt !== "boolean" ||
    typeof data.has_completed_quiz !== "boolean" ||
    LISTS.some((list) => !Array.isArray(data[list]))
  ) {
    throw new ApiError({ kind: "server", status: 200, message: problem });
  }
  return data as OwnHomeProfile;
}

const SAVE_PROBLEM = "We couldn't confirm that was saved. Reload the page to see your Home Profile as it stands.";

/** The human's own Home Profile. 403 for a pet or an admin, 404 when the account has no Home Profile. */
export async function getOwnHomeProfile(client: ApiClient): Promise<OwnHomeProfile> {
  return readOwnHome(await client.get<ApiResource<unknown>>(OWN_HOME), "We couldn't load your Home Profile. Please try again.");
}

/**
 * Saves one quiz step, 1 to 5 as the screen counts them (PR-14…PR-18); build the body with `quizStepPayload`. The
 * API asks for every required answer of the step. Throws ApiError: 422 `fieldErrors` by field.
 */
export async function saveQuizStep(client: ApiClient, step: number, answers: Record<string, unknown>): Promise<OwnHomeProfile> {
  return readOwnHome(await client.patch<ApiResource<unknown>>(apiPath`/me/home-profile/${step}`, answers), SAVE_PROBLEM);
}

/** Saves whatever is answered so far, for Save draft; build the body with `quizDraftPayload`. */
export async function saveQuizDraft(client: ApiClient, answers: Record<string, unknown>): Promise<OwnHomeProfile> {
  return readOwnHome(await client.patch<ApiResource<unknown>>(OWN_HOME, answers), SAVE_PROBLEM);
}

/**
 * Marks the quiz as finished (PR-19 → PR-20): Pets for You unlocks and the match scores are worked out. The API
 * doesn't check the five steps itself yet, so call this only when `quizStepsDone` says they are all answered.
 */
export async function completeQuiz(client: ApiClient): Promise<OwnHomeProfile> {
  return readOwnHome(await client.patch<ApiResource<unknown>>(`${OWN_HOME}/6`, {}), SAVE_PROBLEM);
}

export type IntroChanges = {
  headline: string;
  aboutHome: string;
  /** A new photo to upload; left out, the current one stays. */
  profilePhoto?: File;
  coverPhoto?: File;
};

/**
 * Saves the top of the Home Profile (PR-12). Multipart, because of the photos. Throws ApiError: 422 `fieldErrors`
 * (`headline`, `about_home`, `profile_photo`, `cover_photo`), 413 for a file the server won't take.
 */
export async function updateIntro(client: ApiClient, { headline, aboutHome, profilePhoto, coverPhoto }: IntroChanges): Promise<OwnHomeProfile> {
  const form = new FormData();
  // An empty text clears the field: Laravel reads an empty form value as null.
  form.set("headline", headline.trim());
  form.set("about_home", aboutHome.trim());
  if (profilePhoto) form.set("profile_photo", profilePhoto);
  if (coverPhoto) form.set("cover_photo", coverPhoto);
  return readOwnHome(await client.post<ApiResource<unknown>>(`${OWN_HOME}/intro`, form), SAVE_PROBLEM);
}

/**
 * Turns Open to Adopt on or off (FR4, PR-13, PR-20). Requests already in progress continue either way. Throws
 * ApiError: 409 `quiz_incomplete` when it is turned on before the quiz is finished.
 */
export async function setOpenToAdopt(client: ApiClient, open: boolean): Promise<OwnHomeProfile> {
  return readOwnHome(await client.post<ApiResource<unknown>>("/me/open-to-adopt", { is_open_to_adopt: open }), SAVE_PROBLEM);
}

/** How many pets match this home right now, for "Home Profile saved" (PR-20); null when the API doesn't say. */
export async function getMatchCount(client: ApiClient): Promise<number | null> {
  const response = await client.get<Partial<Paginated<unknown>>>("/matches", { query: { per_page: 1 } });
  const total = response?.meta?.total;
  return typeof total === "number" ? total : null;
}
