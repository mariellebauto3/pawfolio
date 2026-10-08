import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { type ReactNode, Suspense } from "react";
import { Skeleton, SkeletonGroup } from "@/components/feedback/skeleton";
import { Card } from "@/components/ui/card";
import { OPEN_REQUEST_STATUSES } from "@/constants/adoption-requests";
import { HOME_TYPE_LABELS, OUTDOOR_SPACE_LABELS, householdSummary, otherPetsSummary } from "@/constants/home-profiles";
import { ENERGY_LEVEL_LABELS, SPECIES_LABELS, TIME_ALONE_LABELS } from "@/constants/pets";
import { ROUTES, homeProfilePath, petPath, requestPath } from "@/constants/routes";
import { getRequest } from "@/features/adoption-requests/api/requests";
import { HumanRequestPanel } from "@/features/adoption-requests/components/human-request-panel";
import { MatchChip } from "@/features/adoption-requests/components/match-chip";
import { PetRequestPanel } from "@/features/adoption-requests/components/pet-request-panel";
import { RequestAttachments, RequestHistory, RequestLetter } from "@/features/adoption-requests/components/request-content";
import { RequestDetailLayout } from "@/features/adoption-requests/components/request-detail-layout";
import { RequestHeader } from "@/features/adoption-requests/components/request-header";
import type { RequestDetail } from "@/features/adoption-requests/types/requests";
import { getHomeProfileDetail, getPetProfile } from "@/features/discovery/api/discovery";
import { MatchBreakdownButton } from "@/features/matching/components/match-breakdown-button";
import { isApiError } from "@/lib/api/errors";
import { getServerApi } from "@/lib/api/server";
import { homePathFor } from "@/lib/auth/redirects";
import { requireAccount } from "@/lib/auth/require-account";
import { formatAgeMonths } from "@/lib/utils/format-age";
import type { OutdoorSpace } from "@/types/home-profile";

export const metadata: Metadata = { title: "Adoption request" };

type Props = {
  params: Promise<{ requestId: string }>;
};

/** "small yard", or "no outdoor space" where the answer on its own would read "none". */
const outdoorSpace = (space: OutdoorSpace | null) => (space === null ? null : space === "none" ? "no outdoor space" : OUTDOOR_SPACE_LABELS[space].toLowerCase());

const FACTS = "grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm";
const PROFILE_LINK = "inline-flex min-h-11 items-center self-start text-sm font-bold text-primary hover:underline md:min-h-0";

/** The other side's card while its profile loads: it arrives after the request, on its own. */
function AboutFallback({ name }: { name: string }) {
  return (
    <SkeletonGroup label={`Loading ${name}’s details`} className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4 md:p-5">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="w-full" />
      <Skeleton className="w-2/3" />
    </SkeletonGroup>
  );
}

/**
 * The home the request went to, as its public profile describes it: the city and a household summary, never an
 * address (SEC-PRIV-03). A home the pet may no longer open (its account isn't Active any more) is named without a
 * link.
 */
async function AboutHome({ request }: { request: RequestDetail }) {
  const summary = request.home_profile;
  const home = await getHomeProfileDetail(await getServerApi(), summary.id).catch(() => null);

  return (
    <Card title={`About ${summary.full_name}`} action={<MatchChip score={request.match_score ?? undefined} />}>
      {home ? (
        <>
          <dl className={FACTS}>
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
          <Link href={homeProfilePath(home.id)} className={PROFILE_LINK}>
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

/**
 * The pet that sent the request, as its public resume describes it. The caretaker's name and number are not on a
 * resume; they are shared once a Meet & Greet is confirmed (SEC-PRIV-02). A pet whose resume the human may no
 * longer open (its account isn't Active any more) is named without a link.
 */
async function AboutPet({ request }: { request: RequestDetail }) {
  const summary = request.pet;
  const pet = await getPetProfile(await getServerApi(), summary.id).catch(() => null);
  const facts: [string, ReactNode][] = pet
    ? [
        ["Pet", [SPECIES_LABELS[pet.species], pet.breed, formatAgeMonths(pet.approximate_age_months)].filter(Boolean).join(" · ")],
        ["Energy", pet.energy_level ? ENERGY_LEVEL_LABELS[pet.energy_level] : null],
        ["Fine alone", pet.time_alone ? TIME_ALONE_LABELS[pet.time_alone] : null],
        ["Currently at", [pet.currently_at, pet.city].filter(Boolean).join(", ")],
      ]
    : [];

  return (
    <Card title={`About ${summary.name}`}>
      {pet ? (
        <>
          <dl className={FACTS}>
            {facts
              .filter(([, value]) => Boolean(value))
              .map(([label, value]) => (
                <div key={label} className="contents">
                  <dt className="text-ink-muted">{label}</dt>
                  <dd className="wrap-break-word">{value}</dd>
                </div>
              ))}
          </dl>
          <Link href={petPath(pet.id)} className={PROFILE_LINK}>
            View full resume
          </Link>
        </>
      ) : (
        <p className="text-sm text-ink-muted">{summary.name}’s resume isn’t available right now.</p>
      )}
    </Card>
  );
}

/** RQ-14 Sent, RQ-15 On Hold, RQ-17 Declined and every other status, as the pet that sent the request reads it. */
function PetView({ request }: { request: RequestDetail }) {
  const home = request.home_profile;

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
          <RequestHistory request={request} reader="pet" />
          <Suspense fallback={<AboutFallback name={home.full_name} />}>
            <AboutHome request={request} />
          </Suspense>
        </>
      }
    >
      <RequestLetter request={request} />
      <RequestAttachments request={request} resumeHref={ROUTES.me} />
    </RequestDetailLayout>
  );
}

/** RQ-11 New request, and every later status, as the human it was sent to reads it. */
function HumanView({ request }: { request: RequestDetail }) {
  const { pet } = request;
  const age = pet.approximate_age_months === null ? "" : formatAgeMonths(pet.approximate_age_months);
  // Once it has ended, nobody is asking any more.
  const title = OPEN_REQUEST_STATUSES.includes(request.status) ? `${pet.name} wants to join your home` : `${pet.name}’s request to join your home`;

  return (
    <RequestDetailLayout
      header={<RequestHeader request={request} title={title} facts={[pet.breed, age, pet.city].filter(Boolean).join(" · ")} />}
      panel={<HumanRequestPanel request={request} />}
      aside={
        <>
          <RequestHistory request={request} reader="human" />
          <Suspense fallback={<AboutFallback name={pet.name} />}>
            <AboutPet request={request} />
          </Suspense>
        </>
      }
    >
      <RequestLetter request={request} />
      <RequestAttachments request={request} resumeHref={petPath(pet.id)}>
        {/* How well the two fit goes with every request (RQ-11); the breakdown explains it (MT-03). */}
        {request.match_score !== null && (
          <li className="flex min-h-11 flex-wrap items-center gap-2 rounded-control border border-line px-3 py-2">
            <MatchChip score={request.match_score} />
            <MatchBreakdownButton profileId={pet.id} name={pet.name} score={request.match_score} />
          </li>
        )}
      </RequestAttachments>
    </RequestDetailLayout>
  );
}

// One adoption request, read by role: the pet that sent it (RQ-14, RQ-15, RQ-17, with Withdraw, RQ-16) or the
// human it was sent to (RQ-11, with Approve and Decline, RQ-12, RQ-13), on the same layout (FR10, FR24, FR25).
// The API answers only for the two sides of a request; anyone else's is a page that doesn't exist (SEC-AUTHZ-03,
// SEC-AUTHZ-04). The Meet & Greet steps build on the same layout.
export default async function RequestPage({ params }: Props) {
  const { requestId } = await params;
  // Only a plain id goes to the API (SEC-FE-08); anything else is a page that doesn't exist.
  if (!/^[1-9]\d{0,14}$/.test(requestId)) notFound();
  const id = Number(requestId);

  const account = await requireAccount(requestPath(id));
  // An admin reads requests on the monitor (RQ-19).
  if (account.role === "admin") redirect(homePathFor(account));

  const request = await getRequest(await getServerApi(), id).catch((error: unknown) => {
    if (isApiError(error) && error.kind === "not_found") notFound();
    throw error;
  });

  return account.role === "pet" ? <PetView request={request} /> : <HumanView request={request} />;
}
