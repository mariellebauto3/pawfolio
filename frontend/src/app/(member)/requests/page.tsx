import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Pagination } from "@/components/navigation/pagination";
import { Tabs } from "@/components/navigation/tabs";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button-styles";
import { Icon } from "@/components/ui/icon";
import { MAX_OPEN_REQUESTS, REQUEST_COOLDOWN_DAYS, REQUEST_EXPIRY_DAYS } from "@/constants/adoption-requests";
import { ROUTES } from "@/constants/routes";
import { getInbox, getMyRequests } from "@/features/adoption-requests/api/requests";
import { InboxList, RequestList } from "@/features/adoption-requests/components/request-list";
import { inboxHref, inboxTabFromUrl, inboxTotals, requestTabFromUrl, requestTotals, requestsHref } from "@/features/adoption-requests/schemas/requests";
import type { RequestPage } from "@/features/adoption-requests/types/requests";
import { getServerApi } from "@/lib/api/server";
import { homePathFor } from "@/lib/auth/redirects";
import { renderAccount } from "@/lib/auth/render-account";
import { requireAccount } from "@/lib/auth/require-account";
import { pageFromUrl } from "@/lib/utils/page-param";

type SearchParams = Record<string, string | string[] | undefined>;

type Props = {
  searchParams: Promise<SearchParams>;
};

const TITLES = { pet: "My adoption requests", human: "Adoption requests" } as const;

// The tab title follows the role, as the page's own title does. It shares the render's one account lookup.
export async function generateMetadata(): Promise<Metadata> {
  const lookup = await renderAccount();
  const role = lookup.ok && lookup.account ? lookup.account.role : null;
  return { title: role === "human" ? TITLES.human : TITLES.pet };
}

/** A page past the end, such as after the last request on it changed tab: the last page there is now. */
const pastTheEnd = (requests: RequestPage) =>
  requests.data.length === 0 && requests.meta.total > 0 && requests.meta.current_page > requests.meta.last_page;

/** The rules of requests, under the list, for whoever is reading it. */
function Rules({ children }: { children: ReactNode }) {
  return (
    <p className="mt-6 flex items-start gap-2 text-sm text-ink-muted">
      <Icon name="info" className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

/** RQ-07 My requests · Active and RQ-08 · Closed: every request the pet sent, with where it stands (FR24). */
async function MyRequests({ params }: { params: SearchParams }) {
  const tab = requestTabFromUrl(params.tab);
  const requests = await getMyRequests(await getServerApi(), tab, pageFromUrl(params.page));
  if (pastTheEnd(requests)) redirect(requestsHref(tab, requests.meta.last_page));

  const totals = requestTotals(requests.counts);
  const list = (
    <div className="flex flex-col gap-6">
      <RequestList tab={tab} requests={requests.data} />
      <Pagination page={requests.meta.current_page} totalPages={requests.meta.last_page} searchParams={params} label="Pages of requests" />
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-narrow">
      <PageHeader
        title={TITLES.pet}
        description="Requests you sent to homes."
        actions={
          <>
            <Badge tone="progress">
              {totals.open} of {MAX_OPEN_REQUESTS} open
              {totals.inProcess > 0 && ` · ${totals.inProcess} in process`}
            </Badge>
            <Link href={ROUTES.matches} className={buttonClasses({ variant: "primary", size: "sm" })}>
              Find homes
            </Link>
          </>
        }
      />

      <Tabs
        label="My requests"
        tabs={[
          { id: "active", label: "Active", count: totals.open, content: tab === "active" ? list : undefined },
          { id: "closed", label: "Closed", count: totals.closed, content: tab === "closed" ? list : undefined },
        ]}
      />

      <Rules>
        You can have up to {MAX_OPEN_REQUESTS} open requests, and one in process at a time. One request per home; after a Declined or Not Adopted
        result you wait {REQUEST_COOLDOWN_DAYS} days before applying there again. A Sent request expires after {REQUEST_EXPIRY_DAYS} days without an
        answer.
      </Rules>
    </div>
  );
}

/**
 * RQ-09 Requests inbox · New and RQ-10 · In progress, with Closed: the requests pets sent to the human's home
 * (FR10). The three tabs share out every request, so none is lost between them.
 */
async function Inbox({ params }: { params: SearchParams }) {
  const tab = inboxTabFromUrl(params.tab);
  const requests = await getInbox(await getServerApi(), tab, pageFromUrl(params.page));
  if (pastTheEnd(requests)) redirect(inboxHref(tab, requests.meta.last_page));

  const totals = inboxTotals(requests.counts);
  const list = (
    <div className="flex flex-col gap-6">
      <InboxList tab={tab} requests={requests.data} />
      <Pagination page={requests.meta.current_page} totalPages={requests.meta.last_page} searchParams={params} label="Pages of requests" />
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-narrow">
      <PageHeader
        title={TITLES.human}
        description="Requests pets sent to you. You receive requests while Open to Adopt is on."
        actions={
          <Link href={ROUTES.availability} className={buttonClasses({ size: "sm" })}>
            Manage availability
          </Link>
        }
      />

      <Tabs
        label="Adoption requests"
        tabs={[
          { id: "new", label: "New", count: totals.new, content: tab === "new" ? list : undefined },
          { id: "in-progress", label: "In progress", count: totals["in-progress"], content: tab === "in-progress" ? list : undefined },
          { id: "closed", label: "Closed", count: totals.closed, content: tab === "closed" ? list : undefined },
        ]}
      />

      <Rules>
        A new request expires after {REQUEST_EXPIRY_DAYS} days without an answer. Approving one puts the pet In Process, and its requests to other
        homes On Hold. After you decline, the pet waits {REQUEST_COOLDOWN_DAYS} days before it can apply to you again.
      </Rules>
    </div>
  );
}

// `/requests` reads by role: a pet's My requests (RQ-07, RQ-08) or a human's inbox (RQ-09, RQ-10). The tab and the
// page live in the URL (?tab=closed&page=2). The API lists only the caller's own requests and counts them by
// status, which gives the tab counts (SEC-AUTHZ-03).
export default async function RequestsPage({ searchParams }: Props) {
  const params = await searchParams;
  const account = await requireAccount(ROUTES.requests);
  // An admin follows requests on the monitor (RQ-18).
  if (account.role === "admin") redirect(homePathFor(account));

  return account.role === "pet" ? <MyRequests params={params} /> : <Inbox params={params} />;
}
