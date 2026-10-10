import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { ROUTES } from "@/constants/routes";
import { getAccounts } from "@/features/accounts/api/admin-accounts";
import { AccountsFilters } from "@/features/accounts/components/accounts-filters";
import { AccountsList } from "@/features/accounts/components/accounts-list";
import { ACCOUNT_PAGE_PARAM, ACCOUNT_SEARCH_PARAM, ACCOUNT_STATUS_PARAM, ACCOUNT_TAB_PARAM, accountFiltersFromUrl } from "@/features/accounts/schemas/accounts";
import { getServerApi } from "@/lib/api/server";
import { pageFromUrl } from "@/lib/utils/page-param";

export const metadata: Metadata = { title: "Accounts" };

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// AC-06. The tab, the search, the status filter and the page number live in the URL
// (?tab=pet&status=suspended&q=mochi&page=2), so every view of the list can be linked and survives a reload. Only
// values the API knows are sent to it, and it checks the admin role itself (SEC-AUTHZ-07).
export default async function AccountsPage({ searchParams }: Props) {
  const params = await searchParams;
  const filters = accountFiltersFromUrl(params);
  const accounts = await getAccounts(await getServerApi(), { ...filters, page: pageFromUrl(params[ACCOUNT_PAGE_PARAM]) });

  // A page past the end, e.g. after a filter narrowed the list: go to the page that is the last one now.
  if (accounts.data.length === 0 && accounts.meta.total > 0 && accounts.meta.current_page > accounts.meta.last_page) {
    const query = new URLSearchParams({
      ...(filters.tab !== "all" && { [ACCOUNT_TAB_PARAM]: filters.tab }),
      ...(filters.status && { [ACCOUNT_STATUS_PARAM]: filters.status }),
      ...(filters.search && { [ACCOUNT_SEARCH_PARAM]: filters.search }),
      ...(accounts.meta.last_page > 1 && { [ACCOUNT_PAGE_PARAM]: String(accounts.meta.last_page) }),
    }).toString();
    redirect(query ? `${ROUTES.adminAccounts}?${query}` : ROUTES.adminAccounts);
  }

  return (
    <>
      <PageHeader
        title={filters.tab === "alumni" ? "Alumni profiles" : "Accounts & alumni"}
        description={filters.tab === "alumni" ? "Adopted pets and their Furparents." : "All Pet and Human accounts."}
        actions={<AccountsFilters filters={filters} />}
      />
      <AccountsList accounts={accounts} filters={filters} searchParams={params} />
    </>
  );
}
