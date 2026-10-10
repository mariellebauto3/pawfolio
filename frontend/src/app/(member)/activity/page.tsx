import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { ROUTES } from "@/constants/routes";
import { getMyActivity } from "@/features/activity-logs/api/activity-logs";
import { DownloadCsvButton } from "@/features/activity-logs/components/download-csv-button";
import { MyActivity } from "@/features/activity-logs/components/my-activity";
import { ACTIVITY_PAGE_PARAM, ACTIVITY_TAB_PARAM, activityTabFromUrl, typesForTab } from "@/features/activity-logs/schemas/activity-logs";
import { getServerApi } from "@/lib/api/server";
import { requireAccount } from "@/lib/auth/require-account";
import { pageFromUrl } from "@/lib/utils/page-param";

export const metadata: Metadata = { title: "My activity" };

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// LG-01 My activity (pet) and LG-02 (human), one page: the API lists the signed-in account's own activity, so
// nothing differs by role but the entries. The tab and the page live in the URL (?tab=security&page=2), and only
// a tab this page knows is turned into types for the API. An admin reads the platform's log instead.
export default async function MyActivityPage({ searchParams }: Props) {
  const params = await searchParams;
  const account = await requireAccount(ROUTES.activity);
  if (account.role === "admin") redirect(ROUTES.adminActivityLogs);

  const tab = activityTabFromUrl(params[ACTIVITY_TAB_PARAM]);
  const types = typesForTab(tab);
  const entries = await getMyActivity(await getServerApi(), { types, page: pageFromUrl(params[ACTIVITY_PAGE_PARAM]) });

  // A page past the end, such as an address kept from when the list was longer: the last page there is now.
  if (entries.data.length === 0 && entries.meta.total > 0 && entries.meta.current_page > entries.meta.last_page) {
    const query = new URLSearchParams({ ...(tab !== "all" && { [ACTIVITY_TAB_PARAM]: tab }), ...(entries.meta.last_page > 1 && { [ACTIVITY_PAGE_PARAM]: String(entries.meta.last_page) }) }).toString();
    redirect(query ? `${ROUTES.activity}?${query}` : ROUTES.activity);
  }

  return (
    <>
      <PageHeader
        title="My activity"
        description="Important actions on your account. Only you and admins can see this."
        // The file holds what the open tab lists. Nothing to download while the account has no activity at all.
        actions={(entries.meta.total > 0 || tab !== "all") && <DownloadCsvButton scope="mine" types={types} />}
      />
      <MyActivity entries={entries} tab={tab} searchParams={params} />
    </>
  );
}
