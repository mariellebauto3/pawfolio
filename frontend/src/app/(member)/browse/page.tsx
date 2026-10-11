import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { ROUTES } from "@/constants/routes";
import { browseHomes, browsePets } from "@/features/discovery/api/discovery";
import { BrowseResults } from "@/features/discovery/components/browse-results";
import { BrowseForm } from "@/features/discovery/forms/browse-form";
import { browseFiltersFromUrl, browseHref, browseKindFor } from "@/features/discovery/schemas/browse-filters";
import { getServerApi } from "@/lib/api/server";
import { homePathFor } from "@/lib/auth/redirects";
import { requireAccount } from "@/lib/auth/require-account";
import type { PaginationMeta } from "@/types/api";

export const metadata: Metadata = { title: "Browse" };

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** A page past the end, such as an old link after pets were adopted: the last page there is now. */
const pastTheEnd = (meta: PaginationMeta, shown: number) => shown === 0 && meta.total > 0 && meta.current_page > meta.last_page;

// DS-01 Browse pets (human) and DS-02 Browse homes (pet). The search, the filters, the sort and the page live in the
// URL (?species=dog&age=adult&page=2), so every view can be linked and survives a reload. The API decides what is
// listed: only published pets, only homes that are Open to Adopt, public details only (FR6, FR22, NFR4).
export default async function BrowsePage({ searchParams }: Props) {
  const params = await searchParams;
  const account = await requireAccount(ROUTES.browse);
  const kind = browseKindFor(account.role);
  // Admins have their own lists of accounts.
  if (!kind) redirect(homePathFor(account));

  const filters = browseFiltersFromUrl(kind, params);
  const api = await getServerApi();

  if (kind === "pets") {
    const results = await browsePets(api, filters);
    if (pastTheEnd(results.meta, results.data.length)) redirect(browseHref(kind, { ...filters, page: results.meta.last_page }));

    return (
      <>
        <PageHeader title="Browse pets" description="Every pet that’s looking for a home. Narrow them down to the ones that fit your household." />
        <BrowseForm kind={kind} filters={filters}>
          <BrowseResults kind={kind} filters={filters} results={results} />
        </BrowseForm>
      </>
    );
  }

  const results = await browseHomes(api, filters);
  if (pastTheEnd(results.meta, results.data.length)) redirect(browseHref(kind, { ...filters, page: results.meta.last_page }));

  return (
    <>
      <PageHeader title="Browse homes" description="Humans who are Open to Adopt. Narrow them down to the homes that fit you." />
      <BrowseForm kind={kind} filters={filters}>
        <BrowseResults kind={kind} filters={filters} results={results} />
      </BrowseForm>
    </>
  );
}
