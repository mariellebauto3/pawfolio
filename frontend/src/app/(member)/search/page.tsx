import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/feedback/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { ROUTES } from "@/constants/routes";
import { search } from "@/features/discovery/api/discovery";
import { SearchResults } from "@/features/discovery/components/search-results";
import { resultCount, searchFromUrl, searchHref, searchKindFromUrl, searchPageFromUrl } from "@/features/discovery/schemas/search";
import { getServerApi } from "@/lib/api/server";
import { requireAccount } from "@/lib/auth/require-account";

// What was searched for stays out of the tab title and the browser history's titles.
export const metadata: Metadata = { title: "Search" };

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// DS-03 Search results and DS-04 Search · no results, for the search box in the top bar (GN-01). The words, the
// open kind of result and its page live in the URL (?q=quezon+city&type=pets&page=2), so a search can be linked
// and survives a reload.
export default async function SearchPage({ searchParams }: Props) {
  const params = await searchParams;
  const words = searchFromUrl(params);
  const kind = searchKindFromUrl(params);
  const account = await requireAccount(ROUTES.search);

  if (!words) {
    return (
      <>
        <PageHeader title="Search" />
        <EmptyState
          icon="search"
          title="Search pets, homes and posts"
          description="Type a name, a breed, a species or a city in the search box at the top of the page."
        />
      </>
    );
  }

  const results = await search(await getServerApi(), words, kind, searchPageFromUrl(params));

  // A page past the end, such as an old link: the last page there is now.
  if (results.view.kind !== "all") {
    const { meta, data } = results.view.page;
    if (data.length === 0 && meta.total > 0 && meta.current_page > meta.last_page) redirect(searchHref(words, kind, meta.last_page));
  }

  const total = results.totals.pets + results.totals.homes + results.totals.posts;

  return (
    <>
      <PageHeader title={<>Results for “{words}”</>} description={total === 0 ? "No results" : resultCount(total)} />
      <SearchResults results={results} role={account.role} />
    </>
  );
}
