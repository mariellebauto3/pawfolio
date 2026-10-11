import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Pagination } from "@/components/navigation/pagination";
import { ROUTES } from "@/constants/routes";
import { getSavedHomes, getSavedPets } from "@/features/bookmarks/api/bookmarks";
import { NoBookmarks } from "@/features/bookmarks/components/no-bookmarks";
import { SavedList } from "@/features/bookmarks/components/saved-list";
import { getServerApi } from "@/lib/api/server";
import { homePathFor } from "@/lib/auth/redirects";
import { requireAccount } from "@/lib/auth/require-account";
import { pageFromUrl } from "@/lib/utils/page-param";
import type { PaginationMeta } from "@/types/api";

export const metadata: Metadata = { title: "Bookmarks" };

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** A page past the end, such as after the last card on it was removed: the last page there is now. */
const pastTheEnd = (meta: PaginationMeta, shown: number) => shown === 0 && meta.total > 0 && meta.current_page > meta.last_page;

const pageHref = (page: number) => (page > 1 ? `${ROUTES.bookmarks}?page=${page}` : ROUTES.bookmarks);

// BM-01 Bookmarks for a human (saved pets), BM-02 for a pet (saved homes) and BM-04 when nothing is saved. The API
// decides what is listed: only the account's own bookmarks, and only profiles it may still open (FR8, FR23, NFR4).
export default async function BookmarksPage({ searchParams }: Props) {
  const account = await requireAccount(ROUTES.bookmarks);
  // Admins have nothing to save.
  if (account.role === "admin") redirect(homePathFor(account));

  const page = pageFromUrl((await searchParams).page);
  const api = await getServerApi();

  if (account.role === "human") {
    const saved = await getSavedPets(api, page);
    if (pastTheEnd(saved.meta, saved.data.length)) redirect(pageHref(saved.meta.last_page));

    return (
      <Bookmarks kind="pets" meta={saved.meta}>
        <SavedList kind="pets" rows={saved.data} total={saved.meta.total} />
      </Bookmarks>
    );
  }

  const saved = await getSavedHomes(api, page);
  if (pastTheEnd(saved.meta, saved.data.length)) redirect(pageHref(saved.meta.last_page));

  return (
    <Bookmarks kind="homes" meta={saved.meta}>
      <SavedList kind="homes" rows={saved.data} total={saved.meta.total} />
    </Bookmarks>
  );
}

/** What both roles' pages share: the title, the empty state and the pages around the cards. */
function Bookmarks({ kind, meta, children }: { kind: "pets" | "homes"; meta: PaginationMeta; children: ReactNode }) {
  return (
    <>
      <PageHeader title="Bookmarks" description={kind === "pets" ? "Pets you saved for later." : "Homes you saved for later."} />

      {meta.total === 0 ? (
        <NoBookmarks kind={kind} />
      ) : (
        <div className="flex flex-col gap-6">
          {children}
          <Pagination
            page={meta.current_page}
            totalPages={meta.last_page}
            label={kind === "pets" ? "Pages of saved pets" : "Pages of saved homes"}
          />
        </div>
      )}
    </>
  );
}
