import { COOLDOWN_REQUEST_STATUSES, OPEN_REQUEST_STATUSES, REQUEST_COOLDOWN_DAYS } from "@/constants/adoption-requests";
import type { AdoptionRequest } from "@/types/adoption-request";
import type { HomeProfile } from "@/types/home-profile";
import type { RequestStatus } from "@/types/statuses";

// What a pet can do about a home it is reading (DS-07): the rules of proposal §5.3 as far as they decide which
// button shows. The API enforces them when a request is sent; this only keeps the page from offering one it would
// refuse (SEC-FE-05).

export type ApplyState =
  /** One request is still moving: "View my request" takes the place of Apply. */
  | { kind: "open"; requestId: number; status: RequestStatus }
  /** Open to Adopt is off: nobody can apply. */
  | { kind: "not_accepting" }
  /** Declined or Not Adopted less than 30 days ago (RQ-06). */
  | { kind: "cooldown"; until: Date }
  | { kind: "can_apply" };

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Which of the four it is, from the pet's own requests. Requests with other homes are ignored, so the whole list can
 * be passed in.
 */
export function applyStateFor(
  home: Pick<HomeProfile, "id" | "is_open_to_adopt">,
  requests: readonly AdoptionRequest[],
  now: Date,
): ApplyState {
  const withThisHome = requests.filter((request) => request.home_profile?.id === home.id);

  const open = withThisHome.find((request) => OPEN_REQUEST_STATUSES.includes(request.status));
  if (open) return { kind: "open", requestId: open.id, status: open.status };

  if (!home.is_open_to_adopt) return { kind: "not_accepting" };

  const cooldownEnds = withThisHome
    .filter((request) => COOLDOWN_REQUEST_STATUSES.includes(request.status) && request.closed_at)
    .map((request) => new Date(request.closed_at as string).getTime() + REQUEST_COOLDOWN_DAYS * DAY_MS)
    .filter((time) => Number.isFinite(time));
  const latest = Math.max(...cooldownEnds, 0);
  if (latest > now.getTime()) return { kind: "cooldown", until: new Date(latest) };

  return { kind: "can_apply" };
}
