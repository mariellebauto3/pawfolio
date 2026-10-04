"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Alert } from "@/components/feedback/alert";
import { Checkbox } from "@/components/forms/checkbox";
import { Fieldset } from "@/components/forms/fieldset";
import { Button } from "@/components/ui/button";
import { buttonClasses } from "@/components/ui/button-styles";
import { Card } from "@/components/ui/card";
import { ROUTES, adminVerificationReviewPath } from "@/constants/routes";
import { DENIAL_REASON_LABELS } from "@/constants/verification";
import { api } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import { formatDateTime } from "@/lib/utils/format-date";
import { useToast } from "@/providers/toast-provider";
import type { VerificationReview, VerifiedRole } from "@/types/verification-review";
import { approveVerification } from "../api/verification-review";
import { DenyAccountDialog } from "../dialogs/deny-account-dialog";

type Props = Pick<
  VerificationReview,
  "account_id" | "display_name" | "status" | "reviewed_at" | "reviewed_by" | "denial_reason" | "message_to_owner"
> & {
  role: VerifiedRole;
  /** The next account still waiting; null when this was the last. */
  nextAccountId: number | null;
  className?: string;
};

// The toasts of AU-26 and AU-25, as the LoFi words them.
const APPROVED = "Account approved. The owner has been notified.";
const DENIED = "Account denied. The owner can see your reason.";
const CHECKLIST_OPEN = "Tick every check before you approve.";
const UNKNOWN_PROBLEM = "That didn't go through. Check your connection and try again.";

function checklistFor(role: VerifiedRole): string[] {
  return [
    "ID is readable and not expired",
    "Name matches the ID",
    role === "pet" ? "Pet photo is clear" : "Age is 18 or older",
    "No duplicate account found",
  ];
}

// The admin's decision on one account (AU-23…AU-26, FR33). Approving needs every check ticked; the checklist is
// the admin's own working aid and isn't sent. Denying opens the reason dialog. Both are state changes through API
// actions (FR27), logged with the admin's name by the API (NFR9); the page then reloads what the API says.
export function ReviewDecision({ role, nextAccountId, className, ...review }: Props) {
  const router = useRouter();
  const toast = useToast();
  const checks = checklistFor(role);
  const [ticked, setTicked] = useState<boolean[]>(() => checks.map(() => false));
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [approving, setApproving] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const [problem, setProblem] = useState<string | null>(null);
  const [denying, setDenying] = useState(false);
  const boxes = useRef<Array<HTMLInputElement | null>>([]);
  const busy = approving || refreshing;

  /** Says what happened, then reloads the review, the queue position and the sidebar count from the API. */
  function showOutcome(message: string, tone: "success" | "info" = "success") {
    toast.show(message, { tone });
    startRefresh(() => router.refresh());
  }

  async function approve() {
    if (busy) return;
    const firstOpen = ticked.indexOf(false);
    if (firstOpen !== -1) {
      setChecklistOpen(true);
      boxes.current[firstOpen]?.focus();
      return;
    }
    setApproving(true);
    setProblem(null);
    try {
      await approveVerification(api, review.account_id);
      showOutcome(APPROVED);
    } catch (failure) {
      // Another admin decided first: show what they decided instead of an error.
      if (isApiError(failure) && failure.kind === "conflict") showOutcome(failure.message, "info");
      else setProblem(isApiError(failure) ? failure.message : UNKNOWN_PROBLEM);
    } finally {
      setApproving(false);
    }
  }

  if (review.status !== "pending") {
    return (
      <Card title="Decision" className={className}>
        <Outcome review={review} />
        <div className="flex flex-wrap gap-3">
          {nextAccountId !== null && (
            <Link href={adminVerificationReviewPath(nextAccountId)} className={buttonClasses({ variant: "primary" })}>
              Review next account
            </Link>
          )}
          <Link href={ROUTES.adminVerification} className={buttonClasses({ variant: nextAccountId === null ? "primary" : "secondary" })}>
            Back to the queue
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <Card title="Decision" className={className}>
      <Fieldset legend="Checklist" error={checklistOpen ? CHECKLIST_OPEN : undefined}>
        {checks.map((label, index) => (
          <Checkbox
            key={label}
            ref={(element) => {
              boxes.current[index] = element;
            }}
            label={label}
            checked={ticked[index]}
            disabled={busy}
            onChange={(event) => {
              setTicked((current) => current.map((value, i) => (i === index ? event.target.checked : value)));
              setChecklistOpen(false);
            }}
          />
        ))}
      </Fieldset>

      {problem && (
        <Alert tone="error" announce>
          {problem}
        </Alert>
      )}

      <div className="flex flex-wrap gap-3">
        <Button variant="primary" onClick={approve} loading={busy} loadingLabel="Approving the account">
          Approve account
        </Button>
        <Button onClick={() => setDenying(true)} disabled={busy}>
          Deny…
        </Button>
      </div>
      <p className="text-sm text-ink-muted">Every decision is written to the activity log with your name.</p>

      <DenyAccountDialog
        open={denying}
        onClose={() => setDenying(false)}
        accountId={review.account_id}
        name={review.display_name}
        onDenied={() => showOutcome(DENIED)}
        onAlreadyReviewed={(message) => showOutcome(message, "info")}
      />
    </Card>
  );
}

type OutcomeProps = {
  review: Pick<VerificationReview, "display_name" | "status" | "reviewed_at" | "reviewed_by" | "denial_reason" | "message_to_owner">;
};

function Outcome({ review }: OutcomeProps) {
  const by = review.reviewed_by ?? "an admin";
  const when = review.reviewed_at ? ` on ${formatDateTime(review.reviewed_at)}` : "";

  if (review.status === "approved") {
    return (
      <Alert tone="success" title="Approved">
        <p>
          {review.display_name} is Active and can use Pawfolio. Approved by {by}
          {when}.
        </p>
      </Alert>
    );
  }

  // "Other" says nothing on its own; the message carries the reason.
  const reason = review.denial_reason && review.denial_reason !== "other" ? DENIAL_REASON_LABELS[review.denial_reason] : null;
  return (
    <Alert tone="warning" title="Denied">
      {reason && <p className="font-bold">{reason}</p>}
      {review.message_to_owner && <p className="break-words whitespace-pre-line">{review.message_to_owner}</p>}
      <p className="text-ink-muted">
        Denied by {by}
        {when}. The owner can correct their details and resubmit.
      </p>
    </Alert>
  );
}
