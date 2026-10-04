import Link from "next/link";
import { Alert } from "@/components/feedback/alert";
import { PageHeader } from "@/components/layout/page-header";
import { Icon } from "@/components/ui/icon";
import { StatusBadge } from "@/components/ui/status-badge";
import { ROUTES, adminVerificationReviewPath } from "@/constants/routes";
import { ACCOUNT_STATUS_LABELS } from "@/constants/statuses";
import { DENIAL_REASON_LABELS } from "@/constants/verification";
import { formatDate, formatDateTime } from "@/lib/utils/format-date";
import type { VerificationReview } from "@/types/verification-review";
import { ReviewDecision } from "./review-decision";
import { ReviewDetails } from "./review-details";
import { ReviewDocuments } from "./review-documents";

type Props = {
  review: VerificationReview;
};

const STEP_LINK = "inline-flex min-h-11 items-center gap-1 font-bold text-primary underline hover:text-primary-hover md:min-h-0";

// Review one account (AU-23 pet, AU-24 human): what was submitted and the documents on the left, the decision on
// the right, and below them on smaller screens. Once decided, the same page shows the outcome (AU-26).
export function VerificationReviewScreen({ review }: Props) {
  const { queue, previous_denial: previous } = review;
  const pending = review.status === "pending";
  const role = review.details.role;
  const sent = `${review.is_resubmission ? "resubmitted" : "submitted"} ${formatDateTime(review.submitted_at)}`;

  return (
    <>
      <nav aria-label="Verification queue" className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm">
        <Link href={ROUTES.adminVerification} className={STEP_LINK}>
          <Icon name="chevron-left" className="size-4 shrink-0" />
          Verification queue
        </Link>
        <p className="flex items-center gap-3 text-ink-muted">
          {queue.position !== null ? `${queue.position} of ${queue.total}` : `${queue.total} waiting`}
          {queue.next_account_id !== null && (
            <Link href={adminVerificationReviewPath(queue.next_account_id)} className={STEP_LINK}>
              Next
              <Icon name="chevron-right" className="size-4 shrink-0" />
            </Link>
          )}
        </p>
      </nav>

      <PageHeader
        title={`Review: ${review.display_name}`}
        description={`${role === "pet" ? "Pet" : "Human"} account, ${sent}`}
        actions={
          <StatusBadge
            status={pending ? (review.is_resubmission ? "Resubmitted" : "Pending Verification") : ACCOUNT_STATUS_LABELS[review.account_status]}
          />
        }
      />

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-6">
          {previous && (
            <Alert tone="warning" title="Resubmitted after a denial">
              <p>
                Denied on {formatDate(previous.reviewed_at)}
                {previous.denial_reason !== "other" && <>: {DENIAL_REASON_LABELS[previous.denial_reason]}</>}.
              </p>
              {previous.message_to_owner && <p className="break-words whitespace-pre-line">“{previous.message_to_owner}”</p>}
            </Alert>
          )}
          {review.is_resubmission && !previous && (
            <Alert tone="info" title="Details sent again">
              The owner edited their details while the account was waiting for review.
            </Alert>
          )}
          <ReviewDetails details={review.details} />
          <ReviewDocuments key={review.account_id} accountId={review.account_id} ownerName={review.display_name} documents={review.documents} />
        </div>

        <ReviewDecision
          key={review.account_id}
          className="xl:sticky xl:top-8"
          role={role}
          nextAccountId={queue.next_account_id}
          account_id={review.account_id}
          display_name={review.display_name}
          status={review.status}
          reviewed_at={review.reviewed_at}
          reviewed_by={review.reviewed_by}
          denial_reason={review.denial_reason}
          message_to_owner={review.message_to_owner}
        />
      </div>
    </>
  );
}
