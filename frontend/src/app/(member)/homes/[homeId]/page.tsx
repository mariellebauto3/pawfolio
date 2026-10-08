import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { HomeProfileView } from "@/components/data-display/home-profile-view";
import { ROUTES, homeProfilePath } from "@/constants/routes";
import { BookmarkButton } from "@/features/bookmarks/components/bookmark-button";
import { getHomeProfileDetail, getOwnRequests } from "@/features/discovery/api/discovery";
import { HomeProfileActions } from "@/features/discovery/components/home-profile-actions";
import { MatchSummary } from "@/features/discovery/components/match-summary";
import { applyStateFor } from "@/features/discovery/schemas/apply-state";
import { MatchBreakdownButton } from "@/features/matching/components/match-breakdown-button";
import { isApiError } from "@/lib/api/errors";
import { getServerApi } from "@/lib/api/server";
import { requireAccount } from "@/lib/auth/require-account";

export const metadata: Metadata = { title: "Home Profile" };

type Props = {
  params: Promise<{ homeId: string }>;
};

// DS-07 Home Profile as a pet reads it: Apply, or "View my request" when one is already open, beside the match. It
// shows the city and a household summary only; the address and the phone number are shared on a confirmed
// Meet & Greet, never here (NFR4, SEC-PRIV-03). The API decides who may see a home: one that isn't Open to Adopt
// answers 404, a Furparent's included, unless the pet already has a request or an invite with it (SEC-AUTHZ-04).
export default async function HomePage({ params }: Props) {
  const { homeId } = await params;
  // Only a plain id goes to the API (SEC-FE-08); anything else is a page that doesn't exist.
  if (!/^[1-9]\d{0,14}$/.test(homeId)) notFound();
  const id = Number(homeId);

  const account = await requireAccount(homeProfilePath(id));
  // A human's own Home Profile has its own page, with what only they see.
  if (account.role === "human" && account.profile_id === id) redirect(ROUTES.me);

  const api = await getServerApi();
  const [home, requests] = await Promise.all([
    getHomeProfileDetail(api, id).catch((error: unknown) => {
      if (isApiError(error) && error.kind === "not_found") notFound();
      throw error;
    }),
    // Only a pet applies. If its requests can't be read, the page offers Apply and the API answers for the rules.
    account.role === "pet" ? getOwnRequests(api).catch(() => []) : [],
  ]);

  // Humans and admins only read a Home Profile; the actions and the match are the pet's.
  if (account.role !== "pet") return <HomeProfileView home={home} />;

  const state = applyStateFor(home, requests, new Date());

  return (
    <HomeProfileView
      home={home}
      actions={
        <HomeProfileActions
          homeProfileId={home.id}
          state={state}
          bookmark={<BookmarkButton target={{ kind: "home", id: home.id }} name={home.full_name} saved={home.is_bookmarked === true} />}
        />
      }
      aside={
        <MatchSummary
          name={home.full_name}
          match={home.match}
          missing={
            home.has_completed_quiz
              ? {
                  text: "Publish your resume to see how well this home fits you.",
                  action: { href: ROUTES.resumeEdit, label: "Finish your resume" },
                }
              : { text: "This home hasn’t finished its lifestyle quiz yet, so there is no score to show." }
          }
          breakdown={<MatchBreakdownButton profileId={home.id} name={home.full_name} score={home.match?.score} placement="profile" />}
        />
      }
    />
  );
}
