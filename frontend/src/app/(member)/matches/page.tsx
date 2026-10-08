import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { MAX_OPEN_REQUESTS, OPEN_REQUEST_STATUSES } from "@/constants/adoption-requests";
import { ROUTES, homeProfileEditPath, resumeEditPath } from "@/constants/routes";
import { getOwnRequests } from "@/features/discovery/api/discovery";
import { getHomeMatches, getPetMatches } from "@/features/matching/api/matching";
import { MatchFilters } from "@/features/matching/components/match-filters";
import { MatchResults } from "@/features/matching/components/match-results";
import { MatchesNotReady, type SetupStep } from "@/features/matching/components/matches-not-ready";
import { type MatchView, matchKindFor, matchViewFromUrl, matchesHref } from "@/features/matching/schemas/match-view";
import { getOwnHomeProfile } from "@/features/profiles/api/home-profile";
import { getOwnPet } from "@/features/profiles/api/resume";
import { OpenToAdoptSwitch } from "@/features/profiles/components/open-to-adopt-switch";
import { firstOpenQuizStep, quizStepsDone } from "@/features/profiles/schemas/home-profile-schemas";
import { firstOpenStep } from "@/features/profiles/schemas/resume-schemas";
import type { OwnHomeProfile } from "@/features/profiles/types/own-home-profile";
import { getServerApi } from "@/lib/api/server";
import { homePathFor } from "@/lib/auth/redirects";
import { renderAccount } from "@/lib/auth/render-account";
import { requireAccount } from "@/lib/auth/require-account";
import type { PaginationMeta } from "@/types/api";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const TITLES = { pets: "Pets for You", homes: "Homes for You" } as const;

// The tab title follows the role, as the page's own title does. It shares the render's one account lookup.
export async function generateMetadata(): Promise<Metadata> {
  const lookup = await renderAccount();
  const kind = lookup.ok && lookup.account ? matchKindFor(lookup.account.role) : null;
  return { title: kind ? TITLES[kind] : "Matches" };
}

/** A page past the end, such as an old link after pets were adopted: the last page there is now. */
const pastTheEnd = (meta: PaginationMeta, shown: number) => shown === 0 && meta.total > 0 && meta.current_page > meta.last_page;

/** MT-04's checklist: the quiz's first two steps describe the home, and the quiz counts once all six are saved. */
function setupSteps(home: OwnHomeProfile): SetupStep[] {
  const [household, space] = quizStepsDone(home);
  return [
    { label: "Account verified", done: true },
    { label: "Home Profile", done: household && space },
    { label: "Lifestyle quiz", done: home.has_completed_quiz },
    { label: "Open to Adopt", done: home.is_open_to_adopt },
  ];
}

// MT-01 Pets for You (human) and MT-02 Homes for You (pet), with their empty states MT-04 and MT-05 and the match
// breakdown dialog MT-03 on every card. The quick filter, the sort and the page live in the URL
// (?show=dogs&sort=newest&page=2). The API works the matches out: it removes every pair that fails a dealbreaker,
// scores the rest, and says when an account has no matches yet (FR5, FR21, NFR3). Nothing is scored here.
export default async function MatchesPage({ searchParams }: Props) {
  const params = await searchParams;
  const account = await requireAccount(ROUTES.matches);
  const kind = matchKindFor(account.role);
  // Admins aren't matched with anyone.
  if (!kind) redirect(homePathFor(account));

  const view: MatchView = matchViewFromUrl(kind, params);
  const api = await getServerApi();

  if (kind === "pets") {
    // The switch and the checklist are extras: the matches show even when the Home Profile can't be read.
    const [matches, home] = await Promise.all([getPetMatches(api, view), getOwnHomeProfile(api).catch(() => null)]);

    if (!matches.eligible) {
      return (
        <>
          <PageHeader title={TITLES.pets} />
          <MatchesNotReady
            reason={matches.reason}
            setup={home ? setupSteps(home) : undefined}
            continueHref={home ? homeProfileEditPath(firstOpenQuizStep(home) + 1) : ROUTES.homeProfileEdit}
          />
        </>
      );
    }
    if (pastTheEnd(matches.page.meta, matches.page.data.length)) redirect(matchesHref({ ...view, page: matches.page.meta.last_page }));

    return (
      <>
        <PageHeader
          title={TITLES.pets}
          description="Pets ranked by how well they fit your Home Profile and quiz."
          actions={home && <OpenToAdoptSwitch home={home} offHint="Turn this on so pets can find you and send requests." className="max-w-xs" />}
        />
        <div className="flex flex-col gap-4">
          <MatchFilters kind={kind} view={view} />
          <MatchResults kind={kind} view={view} page={matches.page} />
        </div>
      </>
    );
  }

  // The counter is an extra too: without it the page still lists the homes, and the API still enforces the limit.
  const [matches, requests] = await Promise.all([getHomeMatches(api, view), getOwnRequests(api).catch(() => null)]);

  if (!matches.eligible) {
    const pet = matches.reason === "resume_draft" ? await getOwnPet(api).catch(() => null) : null;
    return (
      <>
        <PageHeader title={TITLES.homes} />
        <MatchesNotReady reason={matches.reason} continueHref={pet ? resumeEditPath(firstOpenStep(pet.completeness) + 1) : ROUTES.resumeEdit} />
      </>
    );
  }
  if (pastTheEnd(matches.page.meta, matches.page.data.length)) redirect(matchesHref({ ...view, page: matches.page.meta.last_page }));

  const openRequests = requests?.filter((request) => OPEN_REQUEST_STATUSES.includes(request.status)).length;

  return (
    <>
      <PageHeader
        title={TITLES.homes}
        description="Humans who are Open to Adopt, ranked by how well their home fits you."
        actions={
          openRequests !== undefined && (
            <Badge tone="progress">
              {openRequests} of {MAX_OPEN_REQUESTS} open requests used
            </Badge>
          )
        }
      />
      <div className="flex flex-col gap-4">
        <MatchFilters kind={kind} view={view} />
        <MatchResults kind={kind} view={view} page={matches.page} />
      </div>
    </>
  );
}
