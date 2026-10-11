import { COOLDOWN_REQUEST_STATUSES, IN_PROCESS_REQUEST_STATUSES, MAX_OPEN_REQUESTS, OPEN_REQUEST_STATUSES, REQUEST_COOLDOWN_DAYS } from "@/constants/adoption-requests";
import type { AdoptionRequest } from "@/types/adoption-request";
import type { IsoDateTime } from "@/types/api";
import type { HomeProfile } from "@/types/home-profile";
import type { RequestStatus } from "@/types/statuses";

// What a pet can do about a home (DS-07, RQ-03): the rules of proposal §5.5 as far as they decide what Apply does.
// The API enforces every one of them when a request is sent; this only keeps the screens from offering a form it
// would refuse, and explains the refusal before a letter is written (SEC-FE-05). Everything here is plain data, so
// a server page can work it out and hand it to a client component.

/** One of the pet's open requests, as the dialogs name it (RQ-05). */
export type OpenRequestRef = {
  id: number;
  status: RequestStatus;
  home: { id: number; full_name: string; profile_photo_url: string | null };
};

export type ApplyState =
  /** One request with this home is still moving: "View my request" takes the place of Apply. */
  | { kind: "open"; requestId: number; status: RequestStatus }
  /** Open to Adopt is off: nobody can apply. */
  | { kind: "not_accepting" }
  /** Declined or Not Adopted by this home less than 30 days ago (RQ-06). `last` is the request that ended so. */
  | { kind: "cooldown"; until: IsoDateTime; last: { status: RequestStatus; sent_at: IsoDateTime | null; closed_at: IsoDateTime } }
  /** Another home approved the pet: only one request is in process at a time. */
  | { kind: "in_process"; request: OpenRequestRef }
  /** Three requests are open already (RQ-05). */
  | { kind: "limit"; open: OpenRequestRef[] }
  | { kind: "can_apply" };

/** The states that stop a request from being sent and are explained in a dialog. */
export type ApplyBlocker = Extract<ApplyState, { kind: "cooldown" | "in_process" | "limit" }>;

const DAY_MS = 24 * 60 * 60 * 1000;

const refOf = (request: AdoptionRequest): OpenRequestRef => ({
  id: request.id,
  status: request.status,
  home: { id: request.home_profile.id, full_name: request.home_profile.full_name, profile_photo_url: request.home_profile.profile_photo_url ?? null },
});

/**
 * Which of them it is, from the pet's own requests, newest first. What is about this home comes first (its open
 * request, its switch, its cooldown), then what is about the pet everywhere (in process, the limit), in the order
 * the API checks them.
 */
export function applyStateFor(home: Pick<HomeProfile, "id" | "is_open_to_adopt">, requests: readonly AdoptionRequest[], now: Date): ApplyState {
  const open = requests.filter((request) => OPEN_REQUEST_STATUSES.includes(request.status));
  const withThisHome = requests.filter((request) => request.home_profile?.id === home.id);

  const mine = open.find((request) => request.home_profile?.id === home.id);
  if (mine) return { kind: "open", requestId: mine.id, status: mine.status };

  if (!home.is_open_to_adopt) return { kind: "not_accepting" };

  // The cooldown counts from the latest of the two endings; an ending with no readable date is not guessed at.
  const ended = withThisHome
    .filter((request) => COOLDOWN_REQUEST_STATUSES.includes(request.status) && request.closed_at)
    .map((request) => ({ request, ends: new Date(request.closed_at as string).getTime() + REQUEST_COOLDOWN_DAYS * DAY_MS }))
    .filter(({ ends }) => Number.isFinite(ends))
    .sort((a, b) => b.ends - a.ends)[0];
  if (ended && ended.ends > now.getTime()) {
    const { status, sent_at, closed_at } = ended.request;
    return { kind: "cooldown", until: new Date(ended.ends).toISOString(), last: { status, sent_at, closed_at: closed_at as string } };
  }

  const inProcess = open.find((request) => IN_PROCESS_REQUEST_STATUSES.includes(request.status));
  if (inProcess) return { kind: "in_process", request: refOf(inProcess) };

  if (open.length >= MAX_OPEN_REQUESTS) return { kind: "limit", open: open.map(refOf) };

  return { kind: "can_apply" };
}

export const isApplyBlocker = (state: ApplyState): state is ApplyBlocker =>
  state.kind === "cooldown" || state.kind === "in_process" || state.kind === "limit";

/** The 409 codes of `POST /home-profiles/{home}/adoption-requests` that a dialog explains (RQ-05, RQ-06). */
export const APPLY_BLOCKER_CODES: readonly string[] = ["open_request_limit", "request_cooldown", "pet_in_process", "request_already_open"];
