import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Pagination } from "@/components/navigation/pagination";
import { Icon } from "@/components/ui/icon";
import { MAX_OPEN_REQUESTS } from "@/constants/adoption-requests";
import { ROUTES } from "@/constants/routes";
import { getInvites } from "@/features/adoption-requests/api/invites";
import { InviteList } from "@/features/adoption-requests/components/invite-list";
import { NoInvites } from "@/features/adoption-requests/components/no-invites";
import { inviteApplyState } from "@/features/adoption-requests/schemas/invites";
import { getServerApi } from "@/lib/api/server";
import { homePathFor } from "@/lib/auth/redirects";
import { requireAccount } from "@/lib/auth/require-account";
import { pageFromUrl } from "@/lib/utils/page-param";

export const metadata: Metadata = { title: "Invites to Apply" };

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const pageHref = (page: number) => (page > 1 ? `${ROUTES.invites}?page=${page}` : ROUTES.invites);

// RQ-02 Invites to Apply: the humans who invited this pet to apply, newest first. An invite is a nudge; applying
// stays the pet's choice (FR9, FR24). The API lists only the pet's own invites and decides whether a request can
// be sent when one is (SEC-FE-05).
export default async function InvitesPage({ searchParams }: Props) {
  const account = await requireAccount(ROUTES.invites);
  // Only a pet receives invites; a human sends them from a resume.
  if (account.role !== "pet") redirect(homePathFor(account));

  const page = pageFromUrl((await searchParams).page);
  const invites = await getInvites(await getServerApi(), page);
  // A page past the end, such as after the last invite on it was dismissed: the last page there is now.
  if (invites.data.length === 0 && invites.meta.total > 0 && invites.meta.current_page > invites.meta.last_page) {
    redirect(pageHref(invites.meta.last_page));
  }

  const now = new Date();
  const rows = invites.data.map((invite) => ({ invite, state: inviteApplyState(invite, now) }));

  return (
    <div className="mx-auto w-full max-w-narrow">
      <PageHeader title="Invites to Apply" description="Humans who read your resume and want you to apply. Applying is always your choice." />

      {invites.meta.total === 0 ? (
        <NoInvites />
      ) : (
        <div className="flex flex-col gap-6">
          <InviteList rows={rows} total={invites.meta.total} />
          <Pagination page={invites.meta.current_page} totalPages={invites.meta.last_page} label="Pages of invites" />
          <p className="flex items-start gap-2 text-sm text-ink-muted">
            <Icon name="info" className="mt-0.5 size-4 shrink-0" />
            An invite doesn’t count toward your {MAX_OPEN_REQUESTS} open requests until you apply.
          </p>
        </div>
      )}
    </div>
  );
}
