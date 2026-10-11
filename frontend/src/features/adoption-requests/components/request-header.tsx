import type { ReactNode } from "react";
import { Stepper } from "@/components/forms/stepper";
import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { StatusBadge } from "@/components/ui/status-badge";
import { REQUEST_STATUS_LABELS } from "@/constants/statuses";
import { formatDate } from "@/lib/utils/format-date";
import type { AdoptionRequest } from "@/types/adoption-request";
import { REQUEST_STEPS, requestStep } from "../schemas/request-status";

type Props = {
  request: AdoptionRequest;
  /** The page's one h1, worded for the reader: "Your request to Ana Santos". */
  title: ReactNode;
  /** A few facts about the other side, after the day the request was sent: "Makati · Condo". */
  facts?: string;
};

// The top of a request's page: the pet and the home it applied to, the status as a read-only badge (FR27: nobody
// picks one), and the path every request follows, Sent to Adopted — Hired. A request that ended without an
// adoption has left that path, so it says when it closed instead.
export function RequestHeader({ request, title, facts }: Props) {
  const step = requestStep(request.status);
  const summary = ["Adoption request", request.sent_at && `sent ${formatDate(request.sent_at)}`, facts].filter(Boolean).join(" · ");

  return (
    <header className="flex flex-col gap-4 rounded-card border border-line bg-surface p-4 md:p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
        {/* Decoration: both names are in the title. */}
        <div aria-hidden="true" className="flex shrink-0 items-center gap-1">
          <Avatar name={request.pet.name} src={request.pet.photo_url ?? undefined} alt="" size="lg" />
          <Icon name="chevron-right" className="size-5 text-ink-muted" />
          <Avatar name={request.home_profile.full_name} src={request.home_profile.profile_photo_url ?? undefined} alt="" size="lg" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h1 className="text-2xl wrap-break-word">{title}</h1>
          <p className="text-sm text-ink-muted">{summary}</p>
        </div>
        <StatusBadge status={REQUEST_STATUS_LABELS[request.status]} className="self-start md:self-center" />
      </div>

      {step !== null ? (
        <Stepper steps={REQUEST_STEPS} current={step} />
      ) : (
        request.closed_at && <p className="text-sm text-ink-muted">Closed on {formatDate(request.closed_at)}.</p>
      )}
    </header>
  );
}
