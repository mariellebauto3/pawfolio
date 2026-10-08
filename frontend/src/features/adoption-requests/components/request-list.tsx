import Link from "next/link";
import { EmptyState } from "@/components/feedback/empty-state";
import { Avatar } from "@/components/ui/avatar";
import { buttonClasses } from "@/components/ui/button-styles";
import { Icon } from "@/components/ui/icon";
import { StatusBadge } from "@/components/ui/status-badge";
import { HOME_TYPE_LABELS, householdSummary } from "@/constants/home-profiles";
import { ROUTES, requestPath } from "@/constants/routes";
import { REQUEST_STATUS_LABELS } from "@/constants/statuses";
import type { AdoptionRequest } from "@/types/adoption-request";
import { requestRowDates } from "../schemas/request-status";
import type { RequestTab } from "../schemas/requests";

// One tab of My requests (RQ-07 Active, RQ-08 Closed): each request the pet sent, by the home it went to, with its
// status and its dates. The whole row opens the request, through the home's name. Public details of the home
// only: the city and a household summary (SEC-PRIV-03).

function RequestRow({ request }: { request: AdoptionRequest }) {
  const home = request.home_profile;
  const facts = [home.city, home.home_type && HOME_TYPE_LABELS[home.home_type], householdSummary(home)].filter(Boolean).join(" · ");
  const dates = requestRowDates(request).join(" · ");

  return (
    <li className="relative flex items-start gap-3 rounded-card border border-line bg-surface p-4 transition-colors duration-200 hover:border-line-strong md:items-center md:p-5">
      {/* The name is written beside it, so the photo isn't read out as well. */}
      <Avatar name={home.full_name} src={home.profile_photo_url ?? undefined} alt="" size="lg" />
      <div className="flex min-w-0 flex-1 flex-col gap-2 md:flex-row md:items-center md:gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 className="text-lg wrap-break-word">
            {/* The link covers the row, so the whole of it opens the request. */}
            <Link href={requestPath(request.id)} className="after:absolute after:inset-0 after:rounded-card hover:text-primary">
              {home.full_name}
            </Link>
          </h2>
          {facts && <p className="text-sm text-ink-muted">{facts}</p>}
          {dates && <p className="text-sm text-ink-muted">{dates}</p>}
        </div>
        <StatusBadge status={REQUEST_STATUS_LABELS[request.status]} className="self-start md:self-center" />
      </div>
      <Icon name="chevron-right" className="mt-1 size-5 shrink-0 text-ink-muted md:mt-0" />
    </li>
  );
}

type Props = {
  tab: RequestTab;
  requests: AdoptionRequest[];
};

export function RequestList({ tab, requests }: Props) {
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
      {requests.map((request) => (
        <RequestRow key={request.id} request={request} />
      ))}
    </ul>
  );
}
