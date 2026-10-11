"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import { useToast } from "@/providers/toast-provider";
import { dismissInvite } from "../api/invites";
import type { InviteApplyState } from "../schemas/invites";
import type { Invite } from "../types/invites";
import { InviteCard } from "./invite-card";
import { NoInvites } from "./no-invites";

type Props = {
  /** Each invite with what the pet can do about it, worked out on the server so both renders agree on "now". */
  rows: { invite: Invite; state: InviteApplyState }[];
  total: number;
};

const UNKNOWN_PROBLEM = "We couldn't dismiss that invite. Check your connection and try again.";

// The invites of Invites to Apply (RQ-02). Dismissing one takes its card away at once and asks the server for the
// page again, so the count and the next page's invites follow. The dismissed ids are remembered here because the
// answer may still hold the row for a moment.
export function InviteList({ rows, total }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [dismissed, setDismissed] = useState<readonly number[]>([]);
  const [pending, setPending] = useState<number | null>(null);
  const summary = useRef<HTMLParagraphElement>(null);

  const shown = rows.filter(({ invite }) => !dismissed.includes(invite.id));
  const left = total - (rows.length - shown.length);

  async function dismiss(invite: Invite) {
    if (pending !== null) return;
    setPending(invite.id);
    try {
      await dismissInvite(api, invite.id);
      setDismissed((ids) => [...ids, invite.id]);
      toast.show("Invite dismissed.");
      // The button that had focus is gone with its card; the count is the next thing worth hearing.
      summary.current?.focus();
      router.refresh();
    } catch (problem) {
      toast.show(isApiError(problem) ? problem.message : UNKNOWN_PROBLEM, { tone: "error" });
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p ref={summary} tabIndex={-1} role="status" className="text-sm text-ink-muted">
        {left === 1 ? "1 invite" : `${left} invites`}
      </p>

      {shown.length === 0 ? (
        <NoInvites />
      ) : (
        <ul className="flex flex-col gap-4">
          {shown.map(({ invite, state }) => (
            <li key={invite.id}>
              <InviteCard
                invite={invite}
                state={state}
                dismiss={
                  <Button variant="tertiary" loading={pending === invite.id} loadingLabel="Dismissing the invite" onClick={() => dismiss(invite)}>
                    Dismiss
                    <span className="sr-only"> the invite from {invite.home_profile.full_name}</span>
                  </Button>
                }
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
