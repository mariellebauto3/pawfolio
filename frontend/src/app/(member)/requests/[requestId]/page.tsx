import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { Skeleton, SkeletonGroup } from "@/components/feedback/skeleton";
import { Card } from "@/components/ui/card";
import { HOME_TYPE_LABELS, OUTDOOR_SPACE_LABELS, householdSummary, otherPetsSummary } from "@/constants/home-profiles";
import { ROUTES, homeProfilePath, requestPath } from "@/constants/routes";
import { getRequest } from "@/features/adoption-requests/api/requests";
import { MatchChip } from "@/features/adoption-requests/components/match-chip";
import { PetRequestPanel } from "@/features/adoption-requests/components/pet-request-panel";
import { RequestAttachments, RequestHistory, RequestLetter, RequestThreadLocked } from "@/features/adoption-requests/components/request-content";
import { RequestDetailLayout } from "@/features/adoption-requests/components/request-detail-layout";
import { RequestHeader } from "@/features/adoption-requests/components/request-header";
import type { RequestDetail } from "@/features/adoption-requests/types/requests";
import { getHomeProfileDetail } from "@/features/discovery/api/discovery";
import { isApiError } from "@/lib/api/errors";
import { getServerApi } from "@/lib/api/server";
import { homePathFor } from "@/lib/auth/redirects";
import { requireAccount } from "@/lib/auth/require-account";
import type { OutdoorSpace } from "@/types/home-profile";

export const metadata: Metadata = { title: "Adoption request" };

type Props = {
  params: Promise<{ requestId: string }>;
};

/** "small yard", or "no outdoor space" where the answer on its own would read "none". */
const outdoorSpace = (space: OutdoorSpace | null) => (space === null ? null : space === "none" ? "no outdoor space" : OUTDOOR_SPACE_LABELS[space].toLowerCase());

/**
 * The home the request went to, as its public profile describes it: the city and a household summary, never an
 * address (SEC-PRIV-03). It loads after the request, so it arrives on its own. A home the pet may no longer open
 * (its account isn't Active any more) is named without a link.
 */
async function AboutHome({ request }: { request: RequestDetail }) {
  const summary = request.home_profile;
  const home = await getHomeProfileDetail(await getServerApi(), summary.id).catch(() => null);

  return (
    <Card title={`About ${summary.full_name}`} action={<MatchChip score={request.match_score ?? undefined} />}>
      {home ? (
        <>
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
            <dt className="text-ink-muted">Lives in</dt>
            <dd>{home.city}</dd>
            {home.home_type && (
              <>
                <dt className="text-ink-muted">Home</dt>
                <dd>{[HOME_TYPE_LABELS[home.home_type], outdoorSpace(home.outdoor_space)].filter(Boolean).join(", ")}</dd>
              </>
            )}
            {householdSummary(home) && (
              <>
                <dt className="text-ink-muted">Household</dt>
                <dd>{householdSummary(home)}</dd>
              </>
            )}
            <dt className="text-ink-muted">Other pets</dt>
            <dd>{otherPetsSummary(home)}</dd>
          </dl>
          <Link href={homeProfilePath(home.id)} className="inline-flex min-h-11 items-center self-start text-sm font-bold text-primary hover:underline md:min-h-0">
            View Home Profile
          </Link>
        </>
      ) : (
        <p className="text-sm text-ink-muted">
          {summary.city ? `Lives in ${summary.city}. ` : ""}This Home Profile isn’t available right now.
        </p>
      )}
    </Card>
  );
}

// One adoption request as the pet that sent it reads it: RQ-14 Sent, RQ-15 On Hold and RQ-17 Declined, and every
// other status on the same layout, with Withdraw (RQ-16) until the final decision (FR24, FR25). The API answers
// only for the pet's own requests; anyone else's is a page that doesn't exist (SEC-AUTHZ-03, SEC-AUTHZ-04). The
// human's side of this address (RQ-11) and the Meet & Greet steps build on the same layout.
export default async function RequestPage({ params }: Props) {
  const { requestId } = await params;
  // Only a plain id goes to the API (SEC-FE-08); anything else is a page that doesn't exist.
  if (!/^[1-9]\d{0,14}$/.test(requestId)) notFound();
  const id = Number(requestId);

  const account = await requireAccount(requestPath(id));
  // An admin reads requests on the monitor (RQ-19).
  if (account.role === "admin") redirect(homePathFor(account));
  if (account.role !== "pet") notFound();

  const request = await getRequest(await getServerApi(), id).catch((error: unknown) => {
    if (isApiError(error) && error.kind === "not_found") notFound();
    throw error;
  });

  const home = request.home_profile;
  const waiting = request.status === "sent" || request.status === "on_hold";

  return (
    <RequestDetailLayout
      header={
        <RequestHeader
          request={request}
          title={`Your request to ${home.full_name}`}
          facts={[home.city, home.home_type && HOME_TYPE_LABELS[home.home_type]].filter(Boolean).join(" · ")}
        />
      }
      panel={<PetRequestPanel request={request} />}
      aside={
        <>
          <RequestHistory request={request} />
          <Suspense
            fallback={
              <SkeletonGroup label={`Loading ${home.full_name}’s details`} className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4 md:p-5">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="w-full" />
                <Skeleton className="w-2/3" />
              </SkeletonGroup>
            }
          >
            <AboutHome request={request} />
          </Suspense>
        </>
      }
    >
      <RequestLetter request={request} />
      <RequestAttachments request={request} resumeHref={ROUTES.me} />
      {waiting && !request.is_thread_open && <RequestThreadLocked homeName={home.full_name} />}
    </RequestDetailLayout>
  );
}
