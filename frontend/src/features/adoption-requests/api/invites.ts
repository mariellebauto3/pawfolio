import { type ApiClient, apiPath } from "@/lib/api/core";
import { isHome, isRecord, isText, readPage, unexpected } from "@/lib/api/readers";
import type { ApiResource, Paginated } from "@/types/api";
import { INVITES_PAGE_SIZE } from "../schemas/invites";
import type { Invite, SentInvite } from "../types/invites";

// Invite to Apply calls (docs/api/bookmarks-and-invites.md, RQ-01, RQ-02, FR9). The list is a read, so it works
// from Server Components with `getServerApi()`; sending and dismissing run in the browser. The home that invites is
// the sender's own and the pet that reads is the session's, never a value from the request (SEC-AUTHZ-02). Every
// path with an id is built with apiPath (SEC-FE-08).

const LIST_PROBLEM = "We couldn't load your invites. Please try again.";
const SEND_PROBLEM = "We couldn't tell whether your invite was sent. Reload the page before sending it again.";

const idOrNull = (value: unknown) => (typeof value === "number" ? value : null);
const textOrNull = (value: unknown) => (isText(value) && value !== "" ? value : null);

// A row whose home doesn't match the contract isn't shown: the card reads its lists and its Open to Adopt switch.
function isInviteRow(row: unknown): row is Record<string, unknown> & Pick<Invite, "id" | "home_profile"> {
  return isRecord(row) && typeof row.id === "number" && isHome(row.home_profile);
}

/** The invites the signed-in pet received and hasn't dismissed, newest first (RQ-02). */
export async function getInvites(client: ApiClient, page = 1): Promise<Paginated<Invite>> {
  const response = await client.get<unknown>("/invites", { query: { page: page > 1 ? page : undefined, per_page: INVITES_PAGE_SIZE } });
  const rows = readPage(response, isInviteRow, LIST_PROBLEM);

  // What decides the buttons is read strictly: anything that isn't an id or a date is "not there".
  return {
    ...rows,
    data: rows.data.map((row) => ({
      id: row.id,
      note: textOrNull(row.note),
      created_at: textOrNull(row.created_at),
      open_request_id: idOrNull(row.open_request_id),
      cooldown_until: textOrNull(row.cooldown_until),
      home_profile: row.home_profile,
    })),
  };
}

/**
 * Invites a pet to apply (RQ-01), with an optional personal note. 409 with a message to show when a rule stops it:
 * `not_open_to_adopt`, `pet_not_looking_for_home`, `request_already_open`, `invite_already_sent`.
 */
export async function sendInvite(client: ApiClient, petId: number, note: string | null): Promise<SentInvite> {
  const data = (await client.post<ApiResource<unknown>>(apiPath`/pets/${petId}/invites`, { note }))?.data;
  if (!isRecord(data) || typeof data.id !== "number" || typeof data.pet_id !== "number" || typeof data.home_profile_id !== "number") {
    throw unexpected(SEND_PROBLEM);
  }
  return { id: data.id, pet_id: data.pet_id, home_profile_id: data.home_profile_id, note: textOrNull(data.note), created_at: textOrNull(data.created_at) };
}

/** Dismisses an invite the pet received. Dismissing one twice is not an error. */
export async function dismissInvite(client: ApiClient, inviteId: number): Promise<void> {
  await client.post<unknown>(apiPath`/invites/${inviteId}/dismiss`);
}
