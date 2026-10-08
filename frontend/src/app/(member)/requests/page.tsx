import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Pagination } from "@/components/navigation/pagination";
import { Tabs } from "@/components/navigation/tabs";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button-styles";
import { Icon } from "@/components/ui/icon";
import { MAX_OPEN_REQUESTS, REQUEST_COOLDOWN_DAYS, REQUEST_EXPIRY_DAYS } from "@/constants/adoption-requests";
import { ROUTES } from "@/constants/routes";
import { getMyRequests } from "@/features/adoption-requests/api/requests";
import { RequestList } from "@/features/adoption-requests/components/request-list";
import { requestTabFromUrl, requestTotals, requestsHref } from "@/features/adoption-requests/schemas/requests";
import { getServerApi } from "@/lib/api/server";
import { homePathFor } from "@/lib/auth/redirects";
import { requireAccount } from "@/lib/auth/require-account";
import { pageFromUrl } from "@/lib/utils/page-param";

export const metadata: Metadata = { title: "My adoption requests" };

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// RQ-07 My requests · Active and RQ-08 · Closed: every request the pet sent, with where it stands (FR24). The tab
// and the page live in the URL (?tab=closed&page=2). The API lists only the pet's own requests and counts them by
// status, which gives the tab counts and the "2 of 3 open" line. The human's inbox on this address (RQ-09, RQ-10)
// comes with the human's side of requests; until then it is a page that isn't there for them.
export default async function RequestsPage({ searchParams }: Props) {
  const params = await searchParams;
  const account = await requireAccount(ROUTES.requests);
  // An admin follows requests on the monitor (RQ-18).
  if (account.role === "admin") redirect(homePathFor(account));
  if (account.role !== "pet") notFound();

  const tab = requestTabFromUrl(params.tab);
  const page = pageFromUrl(params.page);
  const requests = await getMyRequests(await getServerApi(), tab, page);
  // A page past the end, such as after the last request on it was withdrawn: the last page there is now.
  if (requests.data.length === 0 && requests.meta.total > 0 && requests.meta.current_page > requests.meta.last_page) {
    redirect(requestsHref(tab, requests.meta.last_page));
  }

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
        title="My adoption requests"
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

      <p className="mt-6 flex items-start gap-2 text-sm text-ink-muted">
        <Icon name="info" className="mt-0.5 size-4 shrink-0" />
        <span>
          You can have up to {MAX_OPEN_REQUESTS} open requests, and one in process at a time. One request per home; after a Declined or Not
          Adopted result you wait {REQUEST_COOLDOWN_DAYS} days before applying there again. A Sent request expires after {REQUEST_EXPIRY_DAYS} days
          without an answer.
        </span>
      </p>
    </div>
  );
}
