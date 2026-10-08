import Link from "next/link";
import type { ReactNode } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { buttonClasses } from "@/components/ui/button-styles";
import { Icon } from "@/components/ui/icon";
import { StatusBadge } from "@/components/ui/status-badge";
import { HOME_TYPE_LABELS, householdSummary } from "@/constants/home-profiles";
import { applyPath, homeProfilePath, requestPath } from "@/constants/routes";
import { formatDate } from "@/lib/utils/format-date";
import type { InviteApplyState } from "../schemas/invites";
import type { Invite } from "../types/invites";
import { MatchChip } from "./match-chip";

type Props = {
  invite: Invite;
  /** What the pet can do about this home (`inviteApplyState`). */
  state: InviteApplyState;
  /** The Dismiss button, which the list owns. */
  dismiss: ReactNode;
};

// One invite on Invites to Apply (RQ-02): who invited, how well they fit, what they wrote, and the way to answer.
// The note is the human's own words, so it is set apart in the heading face and rendered as plain text
// (SEC-FE-01). Public details only: the city and a household summary, never an address (SEC-PRIV-03).
export function InviteCard({ invite, state, dismiss }: Props) {
  const home = invite.home_profile;
  const facts = [home.home_type && HOME_TYPE_LABELS[home.home_type], householdSummary(home)].filter(Boolean).join(" · ");
  const place = [home.city, invite.created_at && `Invited ${formatDate(invite.created_at)}`].filter(Boolean).join(" · ");

  return (
    <article className="flex flex-col gap-4 rounded-card border border-line bg-surface p-4 md:p-5">
      {/* On a phone the match sits under the facts, so the name and the facts keep the full width. */}
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 gap-y-2 sm:grid-cols-[auto_minmax(0,1fr)_auto]">
        {/* The name is written beside it, so the photo isn't read out as well. */}
        <Avatar name={home.full_name} src={home.profile_photo_url ?? undefined} alt="" size="lg" />
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-xl wrap-break-word">
            <Link href={homeProfilePath(home.id)} className="hover:text-primary">
              {home.full_name}
            </Link>
          </h2>
          {facts && <p className="text-sm text-ink-muted">{facts}</p>}
          <p className="text-sm text-ink-muted">{place}</p>
          {home.is_furparent && (
            <div className="pt-1">
              <StatusBadge status="Furparent" />
            </div>
          )}
        </div>
        <div className="col-start-2 justify-self-start sm:col-start-3 sm:row-start-1">
          <MatchChip score={home.match_score} />
        </div>
      </div>

      {invite.note && (
        <blockquote className="rounded-control bg-surface-sunken px-4 py-3 font-display text-lg wrap-break-word">“{invite.note}”</blockquote>
      )}

      {state.kind !== "can_apply" && (
        <p className="flex items-start gap-2 text-sm text-ink-muted">
          <Icon name={state.kind === "open" ? "circle-check" : "clock"} className="mt-0.5 size-4 shrink-0" />
          {state.kind === "open" && "You already applied to this home."}
          {state.kind === "cooldown" &&
            `You can apply to this home again on ${formatDate(state.until)}. After a Declined or Not Adopted result, a pet waits 30 days.`}
          {state.kind === "not_accepting" && "This home turned Open to Adopt off, so it isn’t taking requests right now."}
        </p>
      )}

      {/* On a phone the main action takes the full width, with View home and Dismiss on the row under it. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        {state.kind === "open" && (
          <Link href={requestPath(state.requestId)} className={buttonClasses({ variant: "primary" })}>
            View my request
          </Link>
        )}
        {state.kind === "can_apply" && (
          <Link href={applyPath(home.id)} className={buttonClasses({ variant: "primary" })}>
            Apply for this home
          </Link>
        )}
        {state.kind === "cooldown" && <Button disabled>Apply for this home</Button>}
        {state.kind === "not_accepting" && <Button disabled>Not accepting requests</Button>}

        <div className="flex items-center justify-between gap-3 sm:contents">
          <Link href={homeProfilePath(home.id)} className={buttonClasses()}>
            View home
            <span className="sr-only">: {home.full_name}</span>
          </Link>
          <div className="sm:ml-auto">{dismiss}</div>
        </div>
      </div>
    </article>
  );
}
