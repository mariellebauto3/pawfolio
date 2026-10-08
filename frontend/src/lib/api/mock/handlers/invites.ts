import { ADOPTION_REQUESTS } from "@/lib/api/mock/fixtures/adoption-requests";
import { HOME_PROFILES } from "@/lib/api/mock/fixtures/home-profiles";
import { MATCH_SCORES } from "@/lib/api/mock/fixtures/match-scores";
import { PETS } from "@/lib/api/mock/fixtures/pets";
import { isBookmarked } from "@/lib/api/mock/handlers/bookmarks";
import { type MockRoute, fail, ok, paginate, route, validationFailed } from "@/lib/api/mock/router";
import type { RequestStatus } from "@/types/statuses";

// Invite to Apply in mock mode (docs/api/bookmarks-and-invites.md): a human who is Open to Adopt invites a pet that
// is Looking for a Home, and the pet reads and dismisses its invites, with the same answers as the API. What is
// sent or dismissed lives in memory, so it is back to these after a reload, and a page rendered on the server
// doesn't see what the browser changed.

type Invite = { id: number; pet_id: number; home_profile_id: number; note: string | null; created_at: string; dismissed_at: string | null };

// Mochi (pet 1) was invited by both homes it has since applied to, so both cards show "View my request".
const INVITES: Invite[] = [
  { id: 1, pet_id: 1, home_profile_id: 3, note: "Your resume made us smile. The kids already cleared a spot on the couch.", created_at: "2026-09-18T10:30:00.000000Z", dismissed_at: null },
  { id: 2, pet_id: 1, home_profile_id: 1, note: null, created_at: "2026-09-17T15:05:00.000000Z", dismissed_at: null },
];

const NOTE_MAX = 200;
const COOLDOWN_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
const OPEN_STATUSES: readonly RequestStatus[] = ["sent", "on_hold", "approved", "meet_scheduled", "awaiting_decision"];
const COOLDOWN_STATUSES: readonly RequestStatus[] = ["declined", "not_adopted"];

/** When this home's live invite to the pet was sent, for `invited_at` on the resume a human reads; null without one. */
export function liveInviteAt(petId: number, homeProfileId: number | null): string | null {
  return INVITES.find((invite) => invite.pet_id === petId && invite.home_profile_id === homeProfileId && invite.dismissed_at === null)?.created_at ?? null;
}

const requestsBetween = (petId: number, homeProfileId: number) =>
  ADOPTION_REQUESTS.filter((request) => request.pet.id === petId && request.home_profile.id === homeProfileId);

/** 30 days after the pet's last Declined or Not Adopted result with this home; null once that has passed. */
function cooldownUntil(petId: number, homeProfileId: number): string | null {
  const ends = requestsBetween(petId, homeProfileId)
    .filter((request) => COOLDOWN_STATUSES.includes(request.status) && request.closed_at)
    .map((request) => new Date(request.closed_at as string).getTime() + COOLDOWN_DAYS * DAY_MS);
  const latest = Math.max(...ends, 0);
  return latest > Date.now() ? new Date(latest).toISOString() : null;
}

export const inviteRoutes: MockRoute[] = [
  // Invites to Apply is the pet's screen (RQ-02).
  route("GET", "/invites", ({ query, account }) => {
    if (account?.role !== "pet") return fail(403, "This action is unauthorized.");
    const petId = account.profile_id ?? 0;

    const rows = INVITES.filter((invite) => invite.pet_id === petId && invite.dismissed_at === null)
      .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id)
      .flatMap(({ id, note, created_at, home_profile_id }) => {
        const home = HOME_PROFILES.find((h) => h.id === home_profile_id);
        if (!home) return [];
        const score = MATCH_SCORES[`${petId}:${home.id}`];
        return [
          {
            id,
            note,
            created_at,
            open_request_id: requestsBetween(petId, home.id).find((request) => OPEN_STATUSES.includes(request.status))?.id ?? null,
            cooldown_until: cooldownUntil(petId, home.id),
            home_profile: { ...home, is_bookmarked: isBookmarked(account, { homeProfileId: home.id }), ...(score === undefined ? {} : { match_score: score, match_reasons: [] }) },
          },
        ];
      });

    return { status: 200, body: paginate(rows, query, "/api/v1/invites") };
  }),

  route("POST", "/pets/:petId/invites", ({ params, body, account }) => {
    if (account?.role !== "human") return fail(403, "This action is unauthorized.");

    const sent = (body ?? {}) as { note?: unknown };
    if (sent.note !== undefined && sent.note !== null && typeof sent.note !== "string") {
      return validationFailed({ note: `Keep the note to ${NOTE_MAX} characters or fewer.` });
    }
    const note = typeof sent.note === "string" && sent.note.trim() ? sent.note.trim() : null;
    if (note && note.length > NOTE_MAX) return validationFailed({ note: `Keep the note to ${NOTE_MAX} characters or fewer.` });

    // A Draft answers like a pet that doesn't exist (SEC-AUTHZ-04).
    const pet = PETS.find((p) => String(p.id) === params.petId && p.status !== "draft");
    if (!pet) return fail(404, "We couldn't find that pet.");

    const home = HOME_PROFILES.find((h) => h.id === account.profile_id);
    if (!home || !home.is_open_to_adopt || !home.has_completed_quiz) {
      return fail(409, "Finish your Home Profile and turn on Open to Adopt before you invite a pet to apply.", { code: "not_open_to_adopt" });
    }
    if (pet.status !== "looking_for_a_home") {
      return fail(409, `${pet.name} isn't Looking for a Home right now.`, { code: "pet_not_looking_for_home" });
    }
    if (requestsBetween(pet.id, home.id).some((request) => OPEN_STATUSES.includes(request.status))) {
      return fail(409, `${pet.name} has already applied to your home. Find the request in your Requests.`, { code: "request_already_open" });
    }
    // One live invite per pet and home; a dismissed one doesn't count.
    if (liveInviteAt(pet.id, home.id) !== null) {
      return fail(409, `You have already invited ${pet.name} to apply.`, { code: "invite_already_sent" });
    }

    const invite: Invite = {
      id: Math.max(0, ...INVITES.map((i) => i.id)) + 1,
      pet_id: pet.id,
      home_profile_id: home.id,
      note,
      created_at: new Date().toISOString(),
      dismissed_at: null,
    };
    INVITES.push(invite);

    const { id, pet_id, home_profile_id, created_at } = invite;
    return ok({ id, pet_id, home_profile_id, note, created_at }, 201);
  }),

  route("POST", "/invites/:inviteId/dismiss", ({ params, account }) => {
    // Another pet's invite, or anyone who isn't a pet, is answered like one that doesn't exist (SEC-AUTHZ-04).
    const invite = INVITES.find((i) => String(i.id) === params.inviteId);
    if (!invite || account?.role !== "pet" || invite.pet_id !== account.profile_id) return fail(404, "We couldn't find that invite.");

    // A second press keeps the first time.
    invite.dismissed_at ??= new Date().toISOString();
    return ok({ id: invite.id, dismissed_at: invite.dismissed_at });
  }),
];
