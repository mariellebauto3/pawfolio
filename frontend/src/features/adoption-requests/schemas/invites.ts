import type { Invite } from "../types/invites";

// The rules of an Invite to Apply that the screens need (docs/api/bookmarks-and-invites.md). The API enforces every
// one of them; these only keep the form and the cards from offering what it would refuse (SEC-FE-05).

/** Longest personal note on an invite (RQ-01), as the API's Form Request has it. */
export const INVITE_NOTE_MAX = 200;

/** Invites on one page of Invites to Apply. */
export const INVITES_PAGE_SIZE = 10;

/** The note as it is sent: trimmed, and nothing at all when it is empty. */
export function inviteNote(typed: string): string | null {
  const note = typed.trim();
  return note === "" ? null : note;
}

/** The message for a note that can't be sent, or null when it can. */
export function validateInviteNote(typed: string): string | null {
  return typed.trim().length > INVITE_NOTE_MAX ? `Keep the note to ${INVITE_NOTE_MAX} characters or fewer.` : null;
}

/** What a pet can do about the home that invited it (RQ-02), in the order the Home Profile page decides it (DS-07). */
export type InviteApplyState =
  /** The pet applied already: "View my request" takes the place of Apply. */
  | { kind: "open"; requestId: number }
  /** The home turned Open to Adopt off since it invited. */
  | { kind: "not_accepting" }
  /** Declined or Not Adopted by this home less than 30 days ago (RQ-06). `until` is an ISO date-time. */
  | { kind: "cooldown"; until: string }
  | { kind: "can_apply" };

export function inviteApplyState(invite: Pick<Invite, "open_request_id" | "cooldown_until" | "home_profile">, now: Date): InviteApplyState {
  if (invite.open_request_id !== null) return { kind: "open", requestId: invite.open_request_id };
  if (!invite.home_profile.is_open_to_adopt) return { kind: "not_accepting" };

  const until = invite.cooldown_until ? new Date(invite.cooldown_until).getTime() : Number.NaN;
  if (Number.isFinite(until) && until > now.getTime()) return { kind: "cooldown", until: invite.cooldown_until as string };

  return { kind: "can_apply" };
}
