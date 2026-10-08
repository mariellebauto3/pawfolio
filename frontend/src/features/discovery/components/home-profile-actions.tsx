import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { buttonClasses } from "@/components/ui/button-styles";
import { StatusBadge } from "@/components/ui/status-badge";
import { applyPath, requestPath } from "@/constants/routes";
import { REQUEST_STATUS_LABELS } from "@/constants/statuses";
import { formatDate } from "@/lib/utils/format-date";
import type { ApplyState } from "../schemas/apply-state";

type Props = {
  homeProfileId: number;
  /** What the pet's own requests allow (`applyStateFor`). */
  state: ApplyState;
  /** The Bookmark button (FR23, BM-03), which the Bookmarks module owns; the page passes it in. */
  bookmark?: ReactNode;
};

// What a pet can do from a Home Profile (DS-07). Apply opens the Send request form (RQ-03); with a request already
// open, "View my request" takes its place, so a home never gets two from the same pet. The API refuses a request
// the rules don't allow whatever this shows (SEC-FE-05).
export function HomeProfileActions({ homeProfileId, state, bookmark }: Props) {
  return (
    <>
      {state.kind === "open" && (
        <>
          <Link href={requestPath(state.requestId)} className={buttonClasses({ variant: "primary" })}>
            View my request
          </Link>
          <StatusBadge status={REQUEST_STATUS_LABELS[state.status]} />
        </>
      )}
      {state.kind === "can_apply" && (
        <Link href={applyPath(homeProfileId)} className={buttonClasses({ variant: "primary" })}>
          Apply for this home
        </Link>
      )}
      {state.kind === "not_accepting" && <Button disabled>Not accepting requests</Button>}

      {bookmark}

      {state.kind === "cooldown" && (
        <p className="basis-full text-sm text-ink-muted">
          You can apply to this home again on {formatDate(state.until.toISOString())}. After a Declined or Not Adopted result, a pet waits 30 days.
        </p>
      )}
    </>
  );
}
