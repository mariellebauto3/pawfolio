import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { ROUTES } from "@/constants/routes";
import { getVerificationQueue } from "@/features/auth/api/verification-review";
import { VerificationQueue } from "@/features/auth/components/verification-queue";
import { VerificationSearch } from "@/features/auth/components/verification-search";
import { getServerApi } from "@/lib/api/server";
import { QUEUE_PAGE_PARAM, QUEUE_SEARCH_PARAM, QUEUE_TAB_PARAM, queueFiltersFromUrl } from "@/lib/auth/verification-review";

export const metadata: Metadata = { title: "Verification queue" };

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// AU-22. The tab, the search and the page number live in the URL (?tab=pet&q=carla&page=2), so every view of the
// queue can be linked and survives a reload. The API checks the admin role itself (SEC-AUTHZ-07).
export default async function VerificationQueuePage({ searchParams }: Props) {
  const params = await searchParams;
  const { role, search, page } = queueFiltersFromUrl(params);
  const queue = await getVerificationQueue(await getServerApi(), { role, search, page });

  // A page past the end, e.g. after the last account on it was reviewed: go to the page that is the last one now.
  if (queue.data.length === 0 && queue.meta.total > 0 && queue.meta.current_page > queue.meta.last_page) {
    const query = new URLSearchParams({
      ...(role && { [QUEUE_TAB_PARAM]: role }),
      ...(search && { [QUEUE_SEARCH_PARAM]: search }),
      ...(queue.meta.last_page > 1 && { [QUEUE_PAGE_PARAM]: String(queue.meta.last_page) }),
    }).toString();
    redirect(query ? `${ROUTES.adminVerification}?${query}` : ROUTES.adminVerification);
  }

  return (
    <>
      <PageHeader
        title="Verification queue"
        description="New Human and Pet accounts waiting for review. Newest first."
        actions={<VerificationSearch search={search} role={role} />}
      />
      <VerificationQueue queue={queue} role={role} search={search} searchParams={params} />
    </>
  );
}
