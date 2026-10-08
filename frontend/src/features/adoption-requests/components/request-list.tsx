import Link from "next/link";
import type { ReactNode } from "react";
import { EmptyState } from "@/components/feedback/empty-state";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button-styles";
import { Icon } from "@/components/ui/icon";
import { StatusBadge } from "@/components/ui/status-badge";
import { HOME_TYPE_LABELS, householdSummary } from "@/constants/home-profiles";
import { ROUTES, requestPath } from "@/constants/routes";
import { REQUEST_STATUS_LABELS } from "@/constants/statuses";
import { formatAgeMonths } from "@/lib/utils/format-age";
import type { AdoptionRequest } from "@/types/adoption-request";
import { inboxBadge, requestRowDates } from "../schemas/request-status";
import type { InboxTab, RequestTab } from "../schemas/requests";

// The lists of requests on `/requests`: a pet's My requests (RQ-07 Active, RQ-08 Closed) and a human's inbox
// (RQ-09 New, RQ-10 In progress, and Closed). Each row is the other side of the request, with its status and its
// dates, and the whole row opens the request through the name. Public details only: a home's city and household
// summary, a pet's breed, age and city (SEC-PRIV-03).

type RowProps = {
  request: AdoptionRequest;
  /** The other side of the request: who the row is about. */
  name: string;
  photo: string | null;
  facts: string;
  badge: ReactNode;
};

function RequestRow({ request, name, photo, facts, badge }: RowProps) {
  const dates = requestRowDates(request).join(" · ");

  return (
    <li className="relative flex items-start gap-3 rounded-card border border-line bg-surface p-4 transition-colors duration-200 hover:border-line-strong md:items-center md:p-5">
      {/* The name is written beside it, so the photo isn't read out as well. */}
      <Avatar name={name} src={photo ?? undefined} alt="" size="lg" />
      <div className="flex min-w-0 flex-1 flex-col gap-2 md:flex-row md:items-center md:gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 className="text-lg wrap-break-word">
            {/* The link covers the row, so the whole of it opens the request. */}
            <Link href={requestPath(request.id)} className="after:absolute after:inset-0 after:rounded-card hover:text-primary">
              {name}
            </Link>
          </h2>
          {facts && <p className="text-sm text-ink-muted">{facts}</p>}
          {dates && <p className="text-sm text-ink-muted">{dates}</p>}
        </div>
        <div className="self-start md:self-center">{badge}</div>
      </div>
      <Icon name="chevron-right" className="mt-1 size-5 shrink-0 text-ink-muted md:mt-0" />
    </li>
  );
}

type ListProps = {
  tab: RequestTab;
  requests: AdoptionRequest[];
};

/** A pet's requests, each by the home it went to. */
export function RequestList({ tab, requests }: ListProps) {
  if (requests.length === 0) {
    return tab === "active" ? (
      <EmptyState
        icon="briefcase"
        title="No open requests"
        description="When you apply to a home, you can follow the request here: from Sent to the Meet & Greet and the decision."
        action={
          <Link href={ROUTES.matches} className={buttonClasses({ variant: "primary" })}>
            See Homes for You
          </Link>
        }
        secondaryAction={
          <Link href={ROUTES.browse} className={buttonClasses()}>
            Browse homes
          </Link>
        }
      />
    ) : (
      <EmptyState
        title="Nothing closed yet"
        description="Requests that were declined, withdrawn or expired, and the one that ends in your adoption, are kept here."
      />
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {requests.map((request) => {
        const home = request.home_profile;
        return (
          <RequestRow
            key={request.id}
            request={request}
            name={home.full_name}
            photo={home.profile_photo_url}
            facts={[home.city, home.home_type && HOME_TYPE_LABELS[home.home_type], householdSummary(home)].filter(Boolean).join(" · ")}
            badge={<StatusBadge status={REQUEST_STATUS_LABELS[request.status]} />}
          />
        );
      })}
    </ul>
  );
}

const NOTHING: Record<InboxTab, { title: string; description: string }> = {
  new: {
    title: "No new requests",
    description: "When a pet applies to your home, its request lands here. You receive requests while Open to Adopt is on.",
  },
  "in-progress": {
    title: "Nothing in progress",
    description: "A request you approve moves here, and stays until the decision after the Meet & Greet.",
  },
  closed: {
    title: "Nothing closed yet",
    description: "Requests that were declined, withdrawn or expired, and the ones that end in an adoption, are kept here.",
  },
};

type InboxProps = {
  tab: InboxTab;
  requests: AdoptionRequest[];
};

/** A human's inbox, each request by the pet that sent it. What waits on the human is marked: New, Decision needed. */
export function InboxList({ tab, requests }: InboxProps) {
  if (requests.length === 0) {
    return (
      <EmptyState
        icon="inbox"
        {...NOTHING[tab]}
        action={
          tab === "new" && (
            <Link href={ROUTES.matches} className={buttonClasses({ variant: "primary" })}>
              See Pets for You
            </Link>
          )
        }
      />
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {requests.map((request) => {
        const { pet } = request;
        const { label, needsAnswer } = inboxBadge(request.status);
        const age = pet.approximate_age_months === null ? "" : formatAgeMonths(pet.approximate_age_months);
        return (
          <RequestRow
            key={request.id}
            request={request}
            name={pet.name}
            photo={pet.photo_url}
            facts={[pet.breed, age, pet.city].filter(Boolean).join(" · ")}
            badge={needsAnswer ? <Badge tone="attention">{label}</Badge> : <StatusBadge status={REQUEST_STATUS_LABELS[request.status]} />}
          />
        );
      })}
    </ul>
  );
}
